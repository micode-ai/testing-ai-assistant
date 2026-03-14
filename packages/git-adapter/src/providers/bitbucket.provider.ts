import { createHmac, timingSafeEqual } from 'crypto';
import fetch, { Response, RequestInit } from 'node-fetch';

import {
  GitProvider,
  RepoInfo,
  Branch,
  CommitInfo,
  WebhookInfo,
  PullRequest,
  CommitStatusInput,
} from '../interfaces/git-provider.interface';

export class BitbucketProvider implements GitProvider {
  private readonly baseUrl = 'https://api.bitbucket.org/2.0';
  private readonly token: string;

  constructor(token: string) {
    this.token = token;
  }

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
  }

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const response: Response = await fetch(url, {
      ...options,
      headers: {
        ...this.headers(),
        ...(options?.headers as Record<string, string>),
      },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Bitbucket API error ${response.status}: ${body}`);
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      return (await response.json()) as T;
    }

    return (await response.text()) as unknown as T;
  }

  async getRepository(owner: string, repo: string): Promise<RepoInfo> {
    interface BitbucketRepo {
      uuid: string;
      name: string;
      full_name: string;
      description: string;
      is_private: boolean;
      mainbranch?: { name: string };
      links: {
        clone: Array<{ name: string; href: string }>;
        html: { href: string };
      };
      language: string;
      created_on: string;
      updated_on: string;
    }

    const data = await this.request<BitbucketRepo>(`/repositories/${owner}/${repo}`);

    const cloneLink = data.links.clone.find((l) => l.name === 'https');

    return {
      id: data.uuid,
      name: data.name,
      fullName: data.full_name,
      description: data.description || null,
      private: data.is_private,
      defaultBranch: data.mainbranch?.name ?? 'main',
      cloneUrl: cloneLink?.href ?? '',
      htmlUrl: data.links.html.href,
      language: data.language || null,
      createdAt: data.created_on,
      updatedAt: data.updated_on,
    };
  }

  async getBranches(owner: string, repo: string): Promise<Branch[]> {
    interface BitbucketBranch {
      name: string;
      target: { hash: string };
    }

    interface BitbucketPaginated<T> {
      values: T[];
    }

    const data = await this.request<BitbucketPaginated<BitbucketBranch>>(
      `/repositories/${owner}/${repo}/refs/branches?pagelen=100`,
    );

    return data.values.map((branch) => ({
      name: branch.name,
      sha: branch.target.hash,
      protected: false, // Bitbucket branch restrictions are handled separately
    }));
  }

  async getCommit(owner: string, repo: string, sha: string): Promise<CommitInfo> {
    interface BitbucketCommit {
      hash: string;
      message: string;
      author: { raw: string; user?: { display_name: string } };
      date: string;
      links: { html: { href: string } };
      parents: Array<{ hash: string }>;
    }

    const data = await this.request<BitbucketCommit>(
      `/repositories/${owner}/${repo}/commit/${sha}`,
    );

    const authorParsed = this.parseAuthorRaw(data.author.raw);

    return {
      sha: data.hash,
      message: data.message,
      author: {
        name: authorParsed.name,
        email: authorParsed.email,
        date: data.date,
      },
      committer: {
        name: authorParsed.name,
        email: authorParsed.email,
        date: data.date,
      },
      url: data.links.html.href,
      parents: data.parents.map((p) => p.hash),
    };
  }

  async getDiff(owner: string, repo: string, base: string, head: string): Promise<string> {
    const url = `${this.baseUrl}/repositories/${owner}/${repo}/diff/${base}..${head}`;
    const response = await fetch(url, { headers: this.headers() });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Bitbucket API error ${response.status}: ${body}`);
    }

    return response.text();
  }

  async getFileContent(owner: string, repo: string, path: string, ref?: string): Promise<string> {
    const revision = ref ?? 'HEAD';
    const url = `${this.baseUrl}/repositories/${owner}/${repo}/src/${revision}/${path}`;
    const response = await fetch(url, { headers: this.headers() });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Bitbucket API error ${response.status}: ${body}`);
    }

    return response.text();
  }

  async createWebhook(
    owner: string,
    repo: string,
    url: string,
    secret: string,
    events: string[],
  ): Promise<WebhookInfo> {
    const bitbucketEvents = events.map((e) => this.mapEventToBitbucket(e));

    interface BitbucketWebhook {
      uuid: string;
      url: string;
      events: string[];
      active: boolean;
    }

    const data = await this.request<BitbucketWebhook>(
      `/repositories/${owner}/${repo}/hooks`,
      {
        method: 'POST',
        body: JSON.stringify({
          description: 'Testing AI webhook',
          url,
          secret,
          active: true,
          events: bitbucketEvents,
        }),
      },
    );

    return {
      id: data.uuid,
      url: data.url,
      events: data.events,
      active: data.active,
    };
  }

  async deleteWebhook(owner: string, repo: string, webhookId: string): Promise<void> {
    const url = `${this.baseUrl}/repositories/${owner}/${repo}/hooks/${webhookId}`;
    const response = await fetch(url, {
      method: 'DELETE',
      headers: this.headers(),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Bitbucket API error ${response.status}: ${body}`);
    }
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
    const bitbucketState = this.mapPRStateToBitbucket(state);
    const query = bitbucketState ? `?state=${bitbucketState}&pagelen=50` : '?pagelen=50';

    interface BitbucketPR {
      id: number;
      title: string;
      state: string;
      source: { branch: { name: string } };
      destination: { branch: { name: string } };
      author: { display_name: string; links?: { avatar?: { href: string } } };
    }

    interface BitbucketPaginated<T> {
      values: T[];
    }

    const data = await this.request<BitbucketPaginated<BitbucketPR>>(
      `/repositories/${owner}/${repo}/pullrequests${query}`,
    );

    return data.values.map((pr) => ({
      number: pr.id,
      title: pr.title,
      state: pr.state.toLowerCase(),
      sourceBranch: pr.source.branch.name,
      targetBranch: pr.destination.branch.name,
      author: {
        login: pr.author.display_name,
        avatarUrl: pr.author.links?.avatar?.href,
      },
    }));
  }

  async createCommitStatus(
    owner: string,
    repo: string,
    sha: string,
    status: CommitStatusInput,
  ): Promise<void> {
    const bitbucketState = this.mapCommitStatusState(status.state);

    await this.request(
      `/repositories/${owner}/${repo}/commit/${sha}/statuses/build`,
      {
        method: 'POST',
        body: JSON.stringify({
          state: bitbucketState,
          key: status.context,
          name: status.context,
          description: status.description,
          url: status.targetUrl ?? '',
        }),
      },
    );
  }

  private parseAuthorRaw(raw: string): { name: string; email: string } {
    const match = raw.match(/^(.+?)\s*<(.+?)>$/);
    if (match) {
      return { name: match[1].trim(), email: match[2].trim() };
    }
    return { name: raw, email: '' };
  }

  private mapEventToBitbucket(event: string): string {
    switch (event) {
      case 'push':
        return 'repo:push';
      case 'pull_request':
        return 'pullrequest:created';
      case 'pull_request_update':
        return 'pullrequest:updated';
      case 'pull_request_merge':
        return 'pullrequest:fulfilled';
      default:
        return event;
    }
  }

  private mapPRStateToBitbucket(state: 'open' | 'closed' | 'all'): string {
    switch (state) {
      case 'open':
        return 'OPEN';
      case 'closed':
        return 'MERGED,DECLINED';
      case 'all':
        return '';
    }
  }

  private mapCommitStatusState(
    state: 'pending' | 'success' | 'failure' | 'error',
  ): 'INPROGRESS' | 'SUCCESSFUL' | 'FAILED' | 'STOPPED' {
    switch (state) {
      case 'pending':
        return 'INPROGRESS';
      case 'success':
        return 'SUCCESSFUL';
      case 'failure':
        return 'FAILED';
      case 'error':
        return 'STOPPED';
    }
  }
}
