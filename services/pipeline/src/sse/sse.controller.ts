import { Controller, Get, Param, Sse } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Observable } from 'rxjs';
import { SseService } from './sse.service';

@ApiTags('sse')
@Controller('sse')
export class SseController {
  constructor(private readonly sseService: SseService) {}

  @Get('runs/:runId')
  @Sse()
  @ApiOperation({ summary: 'Subscribe to test run updates via SSE' })
  @ApiResponse({ status: 200, description: 'SSE stream of run events' })
  subscribeToRun(@Param('runId') runId: string): Observable<MessageEvent> {
    return this.sseService.getEventsForRun(runId);
  }
}
