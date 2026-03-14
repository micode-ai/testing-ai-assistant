import {
  Controller,
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
import { TestResultService } from '../test-result/test-result.service';
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
    private readonly testResultService: TestResultService,
  ) {}

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

    return { id: result.id, status: result.status };
  }
}
