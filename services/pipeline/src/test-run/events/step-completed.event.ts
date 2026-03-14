import { DomainEvent } from '@testing-ai/shared-types';

export class StepCompletedEvent implements DomainEvent {
  readonly eventName = 'step.completed';
  readonly timestamp = new Date();

  constructor(
    public readonly aggregateId: string,
    public readonly payload: {
      runId: string;
      checkType: string;
      status: string;
      summary: string;
      durationMs: number;
    },
    public readonly correlationId?: string,
  ) {}
}
