import { Project, RepoProvider, Prisma } from '../../../generated/prisma';

export class ProjectEntity implements Project {
  id: string;
  orgId: string;
  name: string;
  repoUrl: string;
  repoProvider: RepoProvider;
  repoOwner: string;
  repoName: string;
  defaultBranch: string;
  webhookId: string | null;
  webhookSecret: string | null;
  settings: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;

  constructor(partial: Partial<ProjectEntity>) {
    Object.assign(this, partial);
  }
}
