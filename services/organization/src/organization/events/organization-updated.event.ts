import { DomainEvent } from '@testing-ai/shared-types';

export class OrganizationUpdatedEvent implements DomainEvent {
  readonly eventName = 'organization.updated';
  readonly timestamp = new Date();

  constructor(
    public readonly aggregateId: string,
    public readonly payload: Record<string, unknown>,
    public readonly correlationId?: string,
  ) {}
}
