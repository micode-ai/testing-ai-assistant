import { createHmac, timingSafeEqual } from 'crypto';
import { Octokit } from '@octokit/rest';

import {
  GitProvider,
  RepoInfo,
  Branch,
  CommitInfo,
  WebhookInfo,
  PullRequest,
  CommitStatusInput,
} from '../interfaces/git-provider.interface';

export class GitHubProvider implements GitProvider {
  private readonly octokit: Octokit;

  constructor(token: string) {
    this.octokit = new Octokit({ auth: token });
  }

  async getRepository(owner: string, repo: string): Promise<RepoInfo> {
    const { data } = await this.octokit.repos.get({ owner, repo });

    return {
      id: String(data.id),
      name: data.name,
      fullName: data.full_name,
      description: data.description,
      private: data.private,
      defaultBranch: data.default_branch,
      cloneUrl: data.clone_url,
      htmlUrl: data.html_url,
      language: data.language ?? null,
      createdAt: data.created_at ?? '',
      updatedAt: data.updated_at ?? '',
    };
  }

  async getBranches(owner: string, repo: string): Promise<Branch[]> {
    const { data } = await this.octokit.repos.listBranches({
      owner,
      repo,
      per_page: 100,
    });

    return data.map((branch) => ({
      name: branch.name,
      sha: branch.commit.sha,
      protected: branch.protected,
    }));
  }

  async getCommit(owner: string, repo: string, sha: string): Promise<CommitInfo> {
    const { data } = await this.octokit.repos.getCommit({ owner, repo, ref: sha });

    return {
      sha: data.sha,
      message: data.commit.message,
      author: {
        name: data.commit.author?.name ?? '',
        email: data.commit.author?.email ?? '',
        date: data.commit.author?.date ?? '',
      },
      committer: {
        name: data.commit.committer?.name ?? '',
        email: data.commit.committer?.email ?? '',
        date: data.commit.committer?.date ?? '',
      },
      url: data.html_url,
      parents: data.parents.map((p) => p.sha),
    };
  }

  async getDiff(owner: string, repo: string, base: string, head: string): Promise<string> {
    const { data } = await this.octokit.repos.compareCommits({
      owner,
      repo,
      base,
      head,
      mediaType: { format: 'diff' },
    });

    // When requesting diff format, the response is a string
    return data as unknown as string;
  }

  async getFileContent(owner: string, repo: string, path: string, ref?: string): Promise<string> {
    const params: { owner: string; repo: string; path: string; ref?: string } = {
      owner,
      repo,
      path,
    };
    if (ref) {
      params.ref = ref;
    }

    const { data } = await this.octokit.repos.getContent(params);

    if (Array.isArray(data) || data.type !== 'file') {
      throw new Error(`Path "${path}" is not a file`);
    }

    return Buffer.from(data.content, 'base64').toString('utf-8');
  }

  async createWebhook(
    owner: string,
    repo: string,
    url: string,
    secret: string,
    events: string[],
  ): Promise<WebhookInfo> {
    const { data } = await this.octokit.repos.createWebhook({
      owner,
      repo,
      config: {
        url,
        secret,
        content_type: 'json',
      },
      events,
      active: true,
    });

    return {
      id: String(data.id),
      url: data.config.url ?? url,
      events: data.events ?? events,
      active: data.active,
    };
  }

  async deleteWebhook(owner: string, repo: string, webhookId: string): Promise<void> {
    await this.octokit.repos.deleteWebhook({
      owner,
      repo,
      hook_id: Number(webhookId),
    });
  }

  verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
    const expectedSignature =
      'sha256=' + createHmac('sha256', secret).update(payload).digest('hex');

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
    const { data } = await this.octokit.pulls.list({
      owner,
      repo,
      state,
      per_page: 100,
    });

    return data.map((pr) => ({
      number: pr.number,
      title: pr.title,
      state: pr.state,
      sourceBranch: pr.head.ref,
      targetBranch: pr.base.ref,
      author: {
        login: pr.user?.login ?? '',
        avatarUrl: pr.user?.avatar_url,
      },
    }));
  }

  async createCommitStatus(
    owner: string,
    repo: string,
    sha: string,
    status: CommitStatusInput,
  ): Promise<void> {
    await this.octokit.repos.createCommitStatus({
      owner,
      repo,
      sha,
      state: status.state,
      context: status.context,
      description: status.description,
      target_url: status.targetUrl,
    });
  }
}
