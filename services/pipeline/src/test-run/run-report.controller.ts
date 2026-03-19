import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
  Param,
  Logger,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { TestRunService } from './test-run.service';
import { TestRunRepository } from './test-run.repository';
import { TestResultService } from '../test-result/test-result.service';
import { PipelineRepository } from '../pipeline/pipeline.repository';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateRunStatusDto } from './dto/update-run-status.dto';
import { ReportStepResultDto } from './dto/report-step-result.dto';
import { toPrismaCheckType, toPrismaStatus } from './check-type.mapper';

@ApiTags('run-reports (internal)')
@Controller('api/v1/runs')
@Public()
export class RunReportController {
  private readonly logger = new Logger(RunReportController.name);

  constructor(
    private readonly testRunService: TestRunService,
    private readonly testRunRepository: TestRunRepository,
    private readonly testResultService: TestResultService,
    private readonly pipelineRepository: PipelineRepository,
    private readonly prisma: PrismaService,
  ) {}

  @Get('by-project/:projectId/history')
  @ApiOperation({ summary: 'Get recent completed runs with results for a project (internal)' })
  async getHistoryByProject(@Param('projectId') projectId: string) {
    const pipelines = await this.pipelineRepository.findByProjectId(projectId);
    if (pipelines.length === 0) {
      return [];
    }

    const pipelineIds = pipelines.map((p) => p.id);
    const runs = await this.testRunRepository.findRecentCompletedByPipelineIds(pipelineIds, 10);

    return runs.map((run) => ({
      runId: run.id,
      status: run.status,
      branch: (run as any).branch,
      commitSha: (run as any).commitSha,
      finishedAt: run.finishedAt,
      results: ((run as any).results || []).map((r: any) => ({
        checkType: r.checkType,
        status: r.status,
        summary: r.summary,
        details: r.details,
        durationMs: r.durationMs,
      })),
    }));
  }

  @Get('by-project/:projectId/latest')
  @ApiOperation({ summary: 'Get latest completed run with results for a project (internal)' })
  async getLatestByProject(@Param('projectId') projectId: string) {
    const pipelines = await this.pipelineRepository.findByProjectId(projectId);
    if (pipelines.length === 0) {
      return null;
    }

    const pipelineIds = pipelines.map((p) => p.id);
    const run = await this.testRunRepository.findLatestCompletedByPipelineIds(pipelineIds);
    if (!run) {
      return null;
    }

    return {
      runId: run.id,
      status: run.status,
      branch: run.branch,
      commitSha: run.commitSha,
      finishedAt: run.finishedAt,
      results: (run as any).results.map((r: any) => ({
        checkType: r.checkType,
        status: r.status,
        summary: r.summary,
        details: r.details,
        durationMs: r.durationMs,
      })),
    };
  }

  @Patch(':runId/status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update run status (internal, called by test-runner workflow)' })
  async updateStatus(
    @Param('runId') runId: string,
    @Body() dto: UpdateRunStatusDto,
  ) {
    this.logger.log(`Run ${runId} status update: ${dto.status}`);

    const status = dto.status.toUpperCase();

    if (status === 'RUNNING') {
      const run = await this.testRunService.start(runId);
      return { id: run.id, status: run.status };
    }

    if (status === 'COMPLETED' || status === 'PASSED' || status === 'FAILED') {
      const run = await this.testRunService.complete(runId);
      return { id: run.id, status: run.status };
    }

    if (status === 'ERRORED') {
      const run = await this.testRunService.error(runId);
      return { id: run.id, status: run.status };
    }

    if (status === 'CANCELLED') {
      const run = await this.testRunService.cancel(runId);
      return { id: run.id, status: run.status };
    }

    return { id: runId, status };
  }

  @Post(':runId/steps/:checkType/result')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Report step result (internal, called by test-runner workflow)' })
  async reportStepResult(
    @Param('runId') runId: string,
    @Param('checkType') checkType: string,
    @Body() dto: ReportStepResultDto,
  ) {
    this.logger.log(`Run ${runId} step ${checkType} result: ${dto.status}`);

    const prismaCheckType = toPrismaCheckType(checkType);
    const prismaStatus = toPrismaStatus(dto.status);

    // Check if a record already exists for this run+checkType (e.g. RUNNING → PASSED)
    const existing = await this.testResultService.findByRunAndCheckType(runId, prismaCheckType);

    if (existing) {
      const updated = await this.testResultService.updateStatus(existing.id, prismaStatus as any, {
        summary: dto.summary || existing.summary,
        details: dto.details || undefined,
        durationMs: dto.durationMs || 0,
      });
      await this.saveCoverageSnapshot(prismaCheckType, existing.id, dto.details);
      return { id: updated.id, status: updated.status };
    }

    const result = await this.testResultService.create({
      runId,
      checkType: prismaCheckType,
      status: prismaStatus,
      summary: dto.summary || '',
      details: dto.details || {},
      durationMs: dto.durationMs || 0,
    });

    await this.saveCoverageSnapshot(prismaCheckType, result.id, dto.details);

    return { id: result.id, status: result.status };
  }

  /**
   * Persists a CoverageSnapshot when a COVERAGE step result contains coverage data.
   */
  private async saveCoverageSnapshot(
    checkType: string,
    resultId: string,
    details?: Record<string, unknown>,
  ): Promise<void> {
    if (checkType !== 'COVERAGE' || !details) return;

    const linePct = typeof details.linePct === 'number' ? details.linePct : 0;
    const branchPct = typeof details.branchPct === 'number' ? details.branchPct : 0;
    const functionPct = typeof details.functionPct === 'number' ? details.functionPct : 0;

    if (linePct === 0 && branchPct === 0 && functionPct === 0) return;

    try {
      await this.prisma.coverageSnapshot.upsert({
        where: { resultId },
        create: {
          resultId,
          linePct,
          branchPct,
          functionPct,
          uncovered: (details.uncovered as any) ?? {},
        },
        update: {
          linePct,
          branchPct,
          functionPct,
          uncovered: (details.uncovered as any) ?? {},
        },
      });
      this.logger.log(`Coverage snapshot saved for result ${resultId}`);
    } catch (err) {
      this.logger.warn(`Failed to save coverage snapshot: ${err}`);
    }
  }
}
