import { DomainEvent } from '@testing-ai/shared-types';

export class OrganizationCreatedEvent implements DomainEvent {
  readonly eventName = 'organization.created';
  readonly timestamp = new Date();

  constructor(
    public readonly aggregateId: string,
    public readonly payload: { name: string; slug: string; creatorUserId: string },
    public readonly correlationId?: string,
  ) {}
}
