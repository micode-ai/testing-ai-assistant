export class ProjectUpdatedEvent {
  static readonly EVENT_NAME = 'project.updated';

  constructor(
    public readonly projectId: string,
    public readonly orgId: string,
    public readonly changes: Record<string, unknown>,
  ) {}
}
