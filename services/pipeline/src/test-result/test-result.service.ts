import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TestResult, TestStatus } from '../../generated/prisma';
import { TestResultRepository } from './test-result.repository';
import { CreateTestResultDto } from './dto/create-test-result.dto';
import { StepCompletedEvent } from '../test-run/events/step-completed.event';

@Injectable()
export class TestResultService {
  private readonly logger = new Logger(TestResultService.name);

  constructor(
    private readonly testResultRepository: TestResultRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(dto: CreateTestResultDto): Promise<TestResult> {
    const result = await this.testResultRepository.create({
      runId: dto.runId,
      checkType: dto.checkType as any,
      status: (dto.status as TestStatus) ?? 'PENDING',
      summary: dto.summary ?? '',
      details: (dto.details ?? {}) as any,
      artifactUrl: dto.artifactUrl ?? null,
      durationMs: dto.durationMs ?? 0,
    });

    // Emit event so SSE pushes the update to the frontend
    this.eventEmitter.emit(
      'step.completed',
      new StepCompletedEvent(result.id, {
        runId: result.runId,
        checkType: result.checkType,
        status: result.status,
        summary: result.summary,
        durationMs: result.durationMs,
      }),
    );

    this.logger.log(`Test result created: ${result.id} for run ${result.runId}`);
    return result;
  }

  async updateStatus(
    id: string,
    status: TestStatus,
    extra?: { summary?: string; details?: unknown; durationMs?: number; artifactUrl?: string },
  ): Promise<TestResult> {
    const existing = await this.testResultRepository.findById(id);
    if (!existing) {
      throw new NotFoundException('Test result not found');
    }

    const updated = await this.testResultRepository.updateStatus(id, status, extra);

    if (status === 'PASSED' || status === 'FAILED' || status === 'SKIPPED' || status === 'CANCELLED') {
      this.eventEmitter.emit(
        'step.completed',
        new StepCompletedEvent(id, {
          runId: updated.runId,
          checkType: updated.checkType,
          status: updated.status,
          summary: updated.summary,
          durationMs: updated.durationMs,
        }),
      );
    }

    this.logger.log(`Test result ${id} updated to status ${status}`);
    return updated;
  }

  async findByRunAndCheckType(runId: string, checkType: string): Promise<TestResult | null> {
    return this.testResultRepository.findByRunIdAndCheckType(runId, checkType);
  }

  async findByRunId(runId: string): Promise<TestResult[]> {
    return this.testResultRepository.findByRunId(runId);
  }

  async findById(id: string): Promise<TestResult> {
    const result = await this.testResultRepository.findById(id);
    if (!result) {
      throw new NotFoundException('Test result not found');
    }
    return result;
  }
}
