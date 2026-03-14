import { DomainEvent } from '@testing-ai/shared-types';

export class RunCompletedEvent implements DomainEvent {
  readonly eventName = 'run.completed';
  readonly timestamp = new Date();

  constructor(
    public readonly aggregateId: string,
    public readonly payload: { pipelineId: string; status: string; durationMs?: number },
    public readonly correlationId?: string,
  ) {}
}
