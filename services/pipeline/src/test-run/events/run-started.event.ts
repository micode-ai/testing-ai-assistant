import { DomainEvent } from '@testing-ai/shared-types';

export class RunStartedEvent implements DomainEvent {
  readonly eventName = 'run.started';
  readonly timestamp = new Date();

  constructor(
    public readonly aggregateId: string,
    public readonly payload: { pipelineId: string; commitSha: string; branch: string },
    public readonly correlationId?: string,
  ) {}
}
