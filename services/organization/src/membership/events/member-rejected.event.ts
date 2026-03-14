import { DomainEvent } from '@testing-ai/shared-types';

export class MemberRejectedEvent implements DomainEvent {
  readonly eventName = 'member.rejected';
  readonly timestamp = new Date();

  constructor(
    public readonly aggregateId: string,
    public readonly payload: { orgId: string; userId: string; rejectedBy: string },
    public readonly correlationId?: string,
  ) {}
}
