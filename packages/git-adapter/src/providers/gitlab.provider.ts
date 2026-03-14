import { createHmac, timingSafeEqual } from 'crypto';
import { Gitlab } from '@gitbeaker/rest';

import {
  GitProvider,
  RepoInfo,
  Branch,
  CommitInfo,
  WebhookInfo,
  PullRequest,
  CommitStatusInput,
} from '../interfaces/git-provider.interface';

type GitlabClient = InstanceType<typeof Gitlab>;

export class GitLabProvider implements GitProvider {
  private readonly client: GitlabClient;

  constructor(token: string, baseUrl?: string) {
    this.client = new Gitlab({
      token,
      host: baseUrl ?? 'https://gitlab.com',
    });
  }

  private projectId(owner: string, repo: string): string {
    return `${owner}/${repo}`;
  }

  async getRepository(owner: string, repo: string): Promise<RepoInfo> {
    const raw = await this.client.Projects.show(this.projectId(owner, repo));
    const project = raw as Record<string, unknown>;

    return {
      id: String(project.id),
      name: String(project.name),
      fullName: String(project.path_with_namespace),
      description: project.description ? String(project.description) : null,
      private: project.visibility === 'private',
      defaultBranch: project.default_branch ? String(project.default_branch) : 'main',
      cloneUrl: String(project.http_url_to_repo),
      htmlUrl: String(project.web_url),
      language: null,
      createdAt: String(project.created_at),
      updatedAt: String(project.last_activity_at),
    };
  }

  async getBranches(owner: string, repo: string): Promise<Branch[]> {
    const branches = await this.client.Branches.all(this.projectId(owner, repo), {
      perPage: 100,
    });

    return branches.map((branch) => ({
      name: branch.name,
      sha: branch.commit.id,
      protected: branch.protected,
    }));
  }

  async getCommit(owner: string, repo: string, sha: string): Promise<CommitInfo> {
    const raw = await this.client.Commits.show(this.projectId(owner, repo), sha);
    const commit = raw as Record<string, unknown>;

    return {
      sha: String(commit.id),
      message: String(commit.message),
      author: {
        name: String(commit.author_name),
        email: String(commit.author_email),
        date: String(commit.authored_date),
      },
      committer: {
        name: String(commit.committer_name),
        email: String(commit.committer_email),
        date: String(commit.committed_date),
      },
      url: String(commit.web_url),
      parents: (commit.parent_ids as string[]) ?? [],
    };
  }

  async getDiff(owner: string, repo: string, base: string, head: string): Promise<string> {
    const diffs = await this.client.Repositories.compare(
      this.projectId(owner, repo),
      base,
      head,
    );

    const diffList = (diffs.diffs ?? []) as Array<{ old_path: string; new_path: string; diff: string }>;
    return diffList
      .map((d) => {
        const header = `diff --git a/${d.old_path} b/${d.new_path}\n`;
        return header + d.diff;
      })
      .join('\n');
  }

  async getFileContent(owner: string, repo: string, path: string, ref?: string): Promise<string> {
    const file = await this.client.RepositoryFiles.show(
      this.projectId(owner, repo),
      path,
      ref ?? 'HEAD',
    );

    return Buffer.from(file.content, 'base64').toString('utf-8');
  }

  async createWebhook(
    owner: string,
    repo: string,
    url: string,
    secret: string,
    events: string[],
  ): Promise<WebhookInfo> {
    const eventFlags = this.mapEventsToGitLabFlags(events);

    const hook = await this.client.ProjectHooks.add(this.projectId(owner, repo), url, {
      token: secret,
      ...eventFlags,
    });

    return {
      id: String(hook.id),
      url: hook.url,
      events,
      active: true,
    };
  }

  async deleteWebhook(owner: string, repo: string, webhookId: string): Promise<void> {
    await this.client.ProjectHooks.remove(this.projectId(owner, repo), Number(webhookId));
  }

  verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
    const expectedSignature = createHmac('sha256', secret).update(payload).digest('hex');

    const sigBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);

    if (sigBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return timingSafeEqual(sigBuffer, expectedBuffer);
  }

  async listPullRequests(
    owner: string,
    repo: string,
    state: 'open' | 'closed' | 'all' = 'open',
  ): Promise<PullRequest[]> {
    const gitlabState = this.mapPRStateToGitLab(state);

    const mergeRequests = await this.client.MergeRequests.all({
      projectId: this.projectId(owner, repo),
      state: gitlabState as 'opened' | 'closed',
      perPage: 100,
    });

    return mergeRequests.map((mr) => ({
      number: mr.iid,
      title: mr.title,
      state: mr.state as string,
      sourceBranch: mr.source_branch as string,
      targetBranch: mr.target_branch as string,
      author: {
        login: (mr.author as { username?: string })?.username ?? '',
        avatarUrl: (mr.author as { avatar_url?: string })?.avatar_url,
      },
    }));
  }

  async createCommitStatus(
    owner: string,
    repo: string,
    sha: string,
    status: CommitStatusInput,
  ): Promise<void> {
    const gitlabState = this.mapCommitStatusState(status.state);

    await this.client.Commits.editStatus(this.projectId(owner, repo), sha, {
      state: gitlabState,
      name: status.context,
      description: status.description,
      targetUrl: status.targetUrl,
    } as unknown as Parameters<typeof this.client.Commits.editStatus>[2]);
  }

  private mapEventsToGitLabFlags(events: string[]): Record<string, boolean> {
    const flags: Record<string, boolean> = {};

    for (const event of events) {
      switch (event) {
        case 'push':
          flags.pushEvents = true;
          break;
        case 'pull_request':
        case 'merge_request':
          flags.mergeRequestsEvents = true;
          break;
        case 'tag_push':
          flags.tagPushEvents = true;
          break;
        case 'issues':
          flags.issuesEvents = true;
          break;
        case 'note':
        case 'comment':
          flags.noteEvents = true;
          break;
        case 'pipeline':
          flags.pipelineEvents = true;
          break;
        default:
          break;
      }
    }

    return flags;
  }

  private mapPRStateToGitLab(state: 'open' | 'closed' | 'all'): 'opened' | 'closed' | 'all' {
    switch (state) {
      case 'open':
        return 'opened';
      case 'closed':
        return 'closed';
      case 'all':
        return 'all';
    }
  }

  private mapCommitStatusState(
    state: 'pending' | 'success' | 'failure' | 'error',
  ): 'pending' | 'running' | 'success' | 'failed' | 'canceled' {
    switch (state) {
      case 'pending':
        return 'pending';
      case 'success':
        return 'success';
      case 'failure':
        return 'failed';
      case 'error':
        return 'failed';
    }
  }
}
