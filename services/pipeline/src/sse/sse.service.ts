import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Subject, Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';

export interface SseEvent {
  type: 'run.update' | 'step.complete' | 'run.finished';
  runId: string;
  data: Record<string, unknown>;
}

@Injectable()
export class SseService {
  private readonly logger = new Logger(SseService.name);
  private readonly events$ = new Subject<SseEvent>();

  getEventsForRun(runId: string): Observable<MessageEvent> {
    return this.events$.asObservable().pipe(
      filter((event) => event.runId === runId),
      map(
        (event) =>
          ({
            data: JSON.stringify({ type: event.type, ...event.data }),
          }) as MessageEvent,
      ),
    );
  }

  @OnEvent('run.started')
  onRunStarted(event: { aggregateId: string; payload: Record<string, unknown> }) {
    this.logger.debug(`SSE: run started ${event.aggregateId}`);
    this.events$.next({
      type: 'run.update',
      runId: event.aggregateId,
      data: { status: 'RUNNING', ...event.payload },
    });
  }

  @OnEvent('step.completed')
  onStepCompleted(event: { aggregateId: string; payload: { runId: string; checkType: string; status: string; summary: string; durationMs: number } }) {
    this.logger.debug(`SSE: step completed for run ${event.payload.runId}`);
    this.events$.next({
      type: 'step.complete',
      runId: event.payload.runId,
      data: {
        resultId: event.aggregateId,
        checkType: event.payload.checkType,
        status: event.payload.status,
        summary: event.payload.summary,
        durationMs: event.payload.durationMs,
      },
    });
  }

  @OnEvent('run.completed')
  onRunCompleted(event: { aggregateId: string; payload: { pipelineId: string; status: string; durationMs?: number } }) {
    this.logger.debug(`SSE: run completed ${event.aggregateId}`);
    this.events$.next({
      type: 'run.finished',
      runId: event.aggregateId,
      data: {
        status: event.payload.status,
        durationMs: event.payload.durationMs,
      },
    });
  }
}
