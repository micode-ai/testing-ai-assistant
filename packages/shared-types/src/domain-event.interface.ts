export interface DomainEvent {
  eventName: string;
  aggregateId: string;
  payload: Record<string, unknown>;
  timestamp: Date;
  correlationId?: string;
}
