import { DomainEvent } from '@testing-ai/shared-types';

export class MemberInvitedEvent implements DomainEvent {
  readonly eventName = 'member.invited';
  readonly timestamp = new Date();

  constructor(
    public readonly aggregateId: string,
    public readonly payload: {
      orgId: string;
      userId: string;
      invitedBy: string;
      role: string;
    },
    public readonly correlationId?: string,
  ) {}
}
