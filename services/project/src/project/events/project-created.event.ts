export class ProjectCreatedEvent {
  static readonly EVENT_NAME = 'project.created';

  constructor(
    public readonly projectId: string,
    public readonly orgId: string,
    public readonly name: string,
    public readonly repoUrl: string,
    public readonly repoProvider: string,
  ) {}
}
