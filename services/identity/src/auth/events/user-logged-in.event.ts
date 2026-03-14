import { DomainEvent } from '@testing-ai/shared-types';

export class UserLoggedInEvent implements DomainEvent {
  readonly eventName = 'user.logged_in';
  readonly timestamp = new Date();

  constructor(
    public readonly aggregateId: string,
    public readonly payload: { email: string; provider: string },
    public readonly correlationId?: string,
  ) {}
}
