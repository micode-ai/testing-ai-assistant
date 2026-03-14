import { DomainEvent } from '@testing-ai/shared-types';

export class MemberApprovedEvent implements DomainEvent {
  readonly eventName = 'member.approved';
  readonly timestamp = new Date();

  constructor(
    public readonly aggregateId: string,
    public readonly payload: { orgId: string; userId: string; approvedBy: string },
    public readonly correlationId?: string,
  ) {}
}
