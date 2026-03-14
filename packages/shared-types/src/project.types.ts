import { OAuthProvider } from './enums';

export interface ProjectDto {
  id: string;
  orgId: string;
  name: string;
  repoUrl: string;
  repoProvider: OAuthProvider;
  defaultBranch: string;
  webhookId: string | null;
  settings: ProjectSettings;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectSettings {
  autoRunOnPush: boolean;
  autoRunOnPR: boolean;
  defaultPipelineId?: string;
  testFramework?: string;
  buildCommand?: string;
  testCommand?: string;
}

export interface WebhookEvent {
  provider: OAuthProvider;
  event: 'push' | 'pull_request' | 'merge_request';
  repoUrl: string;
  branch: string;
  commitSha: string;
  prNumber?: number;
  prTitle?: string;
  sender: {
    id: string;
    login: string;
    avatarUrl?: string;
  };
  payload: Record<string, unknown>;
}
