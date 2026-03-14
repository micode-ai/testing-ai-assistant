import { DomainEvent } from '@testing-ai/shared-types';

export class PipelineTriggeredEvent implements DomainEvent {
  readonly eventName = 'pipeline.triggered';
  readonly timestamp = new Date();

  constructor(
    public readonly aggregateId: string,
    public readonly payload: { projectId: string; name: string; trigger: string },
    public readonly correlationId?: string,
  ) {}
}
