import { DomainEvent } from '@testing-ai/shared-types';

export class UserRegisteredEvent implements DomainEvent {
  readonly eventName = 'user.registered';
  readonly timestamp = new Date();

  constructor(
    public readonly aggregateId: string,
    public readonly payload: { email: string; name: string },
    public readonly correlationId?: string,
  ) {}
}
