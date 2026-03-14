import {
  Controller, Get, Post, Patch, Body, Param, Logger, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { ChecklistService } from './checklist.service';

/**
 * Internal API for checklist run reporting (called by test-runner workflow).
 */
@ApiTags('checklist-runs (internal)')
@Controller('api/v1/checklist-runs')
@Public()
export class ChecklistRunReportController {
  private readonly logger = new Logger(ChecklistRunReportController.name);

  constructor(private readonly checklistService: ChecklistService) {}

  @Patch(':runId/status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update checklist run status (internal)' })
  async updateStatus(
    @Param('runId') runId: string,
    @Body() dto: { status: string },
  ) {
    const status = dto.status.toUpperCase();
    this.logger.log(`Checklist run ${runId} status: ${status}`);

    if (status === 'RUNNING') {
      const run = await this.checklistService.startRun(runId);
      return { id: run.id, status: run.status };
    }

    if (status === 'COMPLETED' || status === 'PASSED' || status === 'FAILED') {
      const run = await this.checklistService.completeRun(runId);
      return { id: run.id, status: run.status };
    }

    if (status === 'ERRORED') {
      const run = await this.checklistService.errorRun(runId);
      return { id: run.id, status: run.status };
    }

    return { id: runId, status };
  }

  @Post(':runId/items/:itemId/result')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Report checklist item result (internal)' })
  async reportItemResult(
    @Param('runId') runId: string,
    @Param('itemId') itemId: string,
    @Body() dto: {
      status: string;
      summary: string;
      details?: Record<string, unknown>;
      screenshots?: string[];
      durationMs?: number;
    },
  ) {
    this.logger.log(`Checklist run ${runId} item ${itemId}: ${dto.status}`);
    const result = await this.checklistService.reportItemResult(runId, itemId, dto);
    return { id: result.id, status: result.status };
  }
}

/**
 * Public API for viewing checklist runs (requires auth).
 */
import { UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('checklist-runs')
@ApiBearerAuth()
@Controller('checklist-runs')
@UseGuards(JwtAuthGuard)
export class ChecklistRunController {
  constructor(private readonly checklistService: ChecklistService) {}

  @Get(':runId')
  @ApiOperation({ summary: 'Get checklist run with item results' })
  async findById(@Param('runId') runId: string) {
    return this.checklistService.findRunById(runId);
  }
}
