import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TestRun, TestRunStatus } from '../../generated/prisma';
import { TestRunRepository } from './test-run.repository';
import { PipelineService } from '../pipeline/pipeline.service';
import { TemporalService } from '../temporal/temporal.service';
import { ProjectClient } from '../common/clients/project.client';
import { CreateTestRunDto } from './dto/create-test-run.dto';
import { RunStartedEvent } from './events/run-started.event';
import { RunCompletedEvent } from './events/run-completed.event';
import { toWorkflowCheckType } from './check-type.mapper';

@Injectable()
export class TestRunService {
  private readonly logger = new Logger(TestRunService.name);
  private readonly notificationServiceUrl: string;

  constructor(
    private readonly testRunRepository: TestRunRepository,
    private readonly eventEmitter: EventEmitter2,
    private readonly pipelineService: PipelineService,
    private readonly temporalService: TemporalService,
    private readonly projectClient: ProjectClient,
    private readonly configService: ConfigService,
  ) {
    this.notificationServiceUrl = this.configService.get(
      'NOTIFICATION_SERVICE_URL',
      'http://localhost:3006',
    );
  }

  async create(dto: CreateTestRunDto): Promise<TestRun> {
    const run = await this.testRunRepository.create({
      pipelineId: dto.pipelineId,
      commitSha: dto.commitSha,
      branch: dto.branch,
      triggeredBy: dto.triggeredBy ?? null,
      status: 'QUEUED',
    });

    this.logger.log(`Test run created: ${run.id} for pipeline ${run.pipelineId}`);

    // Start Temporal workflow asynchronously
    setImmediate(() => {
      this.startWorkflow(run).catch((err) => {
        this.logger.error(`Failed to start workflow for run ${run.id}: ${err.message}`);
        // Mark run as ERRORED if workflow fails to start
        this.testRunRepository
          .updateStatus(run.id, 'ERRORED', { finishedAt: new Date() })
          .catch(() => {});
      });
    });

    return run;
  }

  private async startWorkflow(run: TestRun): Promise<void> {
    const pipeline = await this.pipelineService.findById(run.pipelineId);
    const steps = (pipeline.steps as unknown as { checkType?: string; name?: string; order?: number; config?: Record<string, unknown> }[]) || [];

    const workflowSteps = steps.map((step, index) => ({
      checkType: toWorkflowCheckType(step.checkType || step.name || 'unit'),
      order: step.order ?? index,
      config: step.config || {},
    }));

    // Fetch project info to get the real repoUrl
    const project = await this.projectClient.getProject(pipeline.projectId);
    const repoUrl = project.repoUrl;

    // Extract owner/name from repoUrl (e.g., https://github.com/owner/repo)
    const urlParts = repoUrl.replace(/\.git$/, '').split('/');
    const repoName = urlParts.pop() || pipeline.projectId;
    const repoOwner = urlParts.pop() || 'unknown';

    const workflowId = await this.temporalService.startTestPipeline({
      runId: run.id,
      pipelineId: run.pipelineId,
      projectId: pipeline.projectId,
      repoUrl,
      repoOwner,
      repoName,
      commitSha: run.commitSha,
      branch: run.branch,
      steps: workflowSteps,
    });

    // Store workflow ID in metadata
    await this.testRunRepository.update(run.id, {
      metadata: { workflowId },
    });

    this.logger.log(`Workflow ${workflowId} started for run ${run.id}`);
  }

  async start(id: string): Promise<TestRun> {
    const run = await this.findById(id);

    // Idempotent: if already RUNNING, return as-is
    if (run.status === 'RUNNING') {
      return run;
    }

    if (run.status !== 'QUEUED') {
      throw new BadRequestException(`Cannot start a run with status ${run.status}`);
    }

    const updated = await this.testRunRepository.updateStatus(id, 'RUNNING', {
      startedAt: new Date(),
    });

    this.eventEmitter.emit(
      'run.started',
      new RunStartedEvent(id, {
        pipelineId: updated.pipelineId,
        commitSha: updated.commitSha,
        branch: updated.branch,
      }),
    );

    this.logger.log(`Test run started: ${id}`);
    return updated;
  }

  async complete(id: string): Promise<TestRun> {
    const run = await this.testRunRepository.findByIdWithResults(id);
    if (!run) {
      throw new NotFoundException('Test run not found');
    }

    if (run.status !== 'RUNNING' && run.status !== 'QUEUED') {
      // Idempotent: if already completed, return as-is
      if (run.status === 'PASSED' || run.status === 'FAILED') {
        return run;
      }
      throw new BadRequestException(`Cannot complete a run with status ${run.status}`);
    }

    const hasFailed = run.results.some(
      (r) => r.status === 'FAILED' || r.status === 'CANCELLED',
    );
    const finalStatus: TestRunStatus = hasFailed ? 'FAILED' : 'PASSED';
    const finishedAt = new Date();
    const durationMs = run.startedAt ? finishedAt.getTime() - run.startedAt.getTime() : 0;

    const updated = await this.testRunRepository.updateStatus(id, finalStatus, { finishedAt });

    this.eventEmitter.emit(
      'run.completed',
      new RunCompletedEvent(id, {
        pipelineId: run.pipelineId,
        status: finalStatus,
        durationMs,
      }),
    );

    this.logger.log(`Test run completed: ${id} with status ${finalStatus}`);

    // Notify notification service asynchronously
    this.sendRunNotification(run.pipelineId, id, finalStatus, run.results, durationMs).catch(
      (err) => this.logger.warn(`Failed to send notification: ${err}`),
    );

    return updated;
  }

  private async sendRunNotification(
    pipelineId: string,
    runId: string,
    status: string,
    results: Array<{ status: string }>,
    durationMs: number,
  ): Promise<void> {
    try {
      const pipeline = await this.pipelineService.findById(pipelineId);
      if (!pipeline) return;

      const project = await this.projectClient.getProject(pipeline.projectId);

      const passed = results.filter((r) => r.status === 'PASSED').length;
      const failed = results.filter((r) => r.status === 'FAILED').length;
      const skipped = results.filter((r) => !['PASSED', 'FAILED'].includes(r.status)).length;
      const event = status === 'FAILED' ? 'run.failed' : 'run.finished';

      await fetch(`${this.notificationServiceUrl}/api/v1/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgId: project.orgId,
          event,
          data: {
            runId,
            runName: pipeline.name,
            passed,
            failed,
            skipped,
            total: results.length,
            duration: `${Math.round(durationMs / 1000)}s`,
          },
        }),
      });
    } catch (error) {
      this.logger.warn(`Notification service unreachable: ${error}`);
    }
  }

  async error(id: string): Promise<TestRun> {
    const run = await this.findById(id);

    if (run.status === 'ERRORED') {
      return run;
    }

    const updated = await this.testRunRepository.updateStatus(id, 'ERRORED', {
      finishedAt: new Date(),
    });

    this.eventEmitter.emit(
      'run.completed',
      new RunCompletedEvent(id, {
        pipelineId: run.pipelineId,
        status: 'ERRORED',
      }),
    );

    this.logger.log(`Test run errored: ${id}`);
    return updated;
  }

  async cancel(id: string): Promise<TestRun> {
    const run = await this.findById(id);

    if (run.status !== 'QUEUED' && run.status !== 'RUNNING') {
      if (run.status === 'CANCELLED') {
        return run;
      }
      throw new BadRequestException(`Cannot cancel a run with status ${run.status}`);
    }

    const updated = await this.testRunRepository.updateStatus(id, 'CANCELLED', {
      finishedAt: new Date(),
    });

    this.eventEmitter.emit(
      'run.completed',
      new RunCompletedEvent(id, {
        pipelineId: run.pipelineId,
        status: 'CANCELLED',
      }),
    );

    this.logger.log(`Test run cancelled: ${id}`);
    return updated;
  }

  async findByPipeline(pipelineId: string): Promise<TestRun[]> {
    return this.testRunRepository.findByPipelineId(pipelineId);
  }

  async findRecent(limit = 50): Promise<TestRun[]> {
    return this.testRunRepository.findRecent(limit);
  }

  async findById(id: string): Promise<TestRun> {
    const run = await this.testRunRepository.findById(id);
    if (!run) {
      throw new NotFoundException('Test run not found');
    }
    return run;
  }

  async findByIdWithResults(id: string) {
    const run = await this.testRunRepository.findByIdWithResults(id);
    if (!run) {
      throw new NotFoundException('Test run not found');
    }
    return run;
  }

}
