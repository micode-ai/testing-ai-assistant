import { Logger } from '@nestjs/common';
import {
  GitAdapter,
  FileTreeEntry,
  FileContent,
  CommitFile,
  CommitResult,
  PullRequestResult,
  DiffEntry,
} from './git-adapter.interface';

export class BitbucketAdapter implements GitAdapter {
  private readonly logger = new Logger(BitbucketAdapter.name);
  private readonly baseUrl = 'https://api.bitbucket.org/2.0';

  constructor(private readonly token: string) {}

  private async request<T>(
    path: string,
    options: RequestInit = {},
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        ...((options.headers as Record<string, string>) || {}),
      },
    });

    if (!response.ok) {
      const body = await response.text();
      this.logger.error(`Bitbucket API error: ${response.status} ${path} - ${body}`);
      throw new Error(`Bitbucket API error: ${response.status} - ${body}`);
    }

    return response.json() as Promise<T>;
  }

  private async requestRaw(
    path: string,
    options: RequestInit = {},
  ): Promise<string> {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.token}`,
        ...((options.headers as Record<string, string>) || {}),
      },
    });

    if (!response.ok) {
      throw new Error(`Bitbucket API error: ${response.status}`);
    }

    return response.text();
  }

  async getFileTree(
    owner: string,
    repo: string,
    branch: string,
    pathPrefix?: string,
  ): Promise<FileTreeEntry[]> {
    const entries: FileTreeEntry[] = [];
    let url: string | null =
      `/repositories/${owner}/${repo}/src/${branch}/${pathPrefix || ''}?pagelen=100`;

    const ignoredPrefixes = [
      'node_modules/',
      '.git/',
      'dist/',
      'build/',
      '.next/',
      'coverage/',
    ];

    while (url) {
      const data: {
        values: Array<{ path: string; type: string; size?: number }>;
        next?: string;
      } = await this.request(url);

      for (const item of data.values) {
        if (ignoredPrefixes.some((p) => item.path.startsWith(p))) continue;
        entries.push({
          path: item.path,
          type: item.type === 'commit_file' ? 'file' : 'dir',
          size: item.size,
        });
      }

      url = data.next
        ? data.next.replace(this.baseUrl, '')
        : null;
    }

    return entries;
  }

  async getFileContent(
    owner: string,
    repo: string,
    branch: string,
    filePath: string,
  ): Promise<FileContent> {
    const content = await this.requestRaw(
      `/repositories/${owner}/${repo}/src/${branch}/${filePath}`,
    );

    return {
      path: filePath,
      content,
      encoding: 'utf-8',
      size: Buffer.byteLength(content, 'utf-8'),
    };
  }

  async getMultipleFiles(
    owner: string,
    repo: string,
    branch: string,
    filePaths: string[],
  ): Promise<FileContent[]> {
    const results: FileContent[] = [];
    const batchSize = 5;

    for (let i = 0; i < filePaths.length; i += batchSize) {
      const batch = filePaths.slice(i, i + batchSize);
      const batchResults = await Promise.allSettled(
        batch.map((fp) => this.getFileContent(owner, repo, branch, fp)),
      );

      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        }
      }
    }

    return results;
  }

  async getDiff(
    owner: string,
    repo: string,
    base: string,
    head: string,
  ): Promise<DiffEntry[]> {
    const data = await this.request<{
      values: Array<{
        old?: { path: string };
        new?: { path: string };
        status: { category: string };
        lines_added: number;
        lines_removed: number;
      }>;
    }>(`/repositories/${owner}/${repo}/diffstat/${base}..${head}`);

    return data.values.map((f) => ({
      filename: f.new?.path || f.old?.path || '',
      status: this.mapStatus(f.status.category),
      additions: f.lines_added,
      deletions: f.lines_removed,
    }));
  }

  private mapStatus(
    category: string,
  ): DiffEntry['status'] {
    switch (category) {
      case 'added':
        return 'added';
      case 'removed':
        return 'removed';
      case 'renamed':
        return 'renamed';
      default:
        return 'modified';
    }
  }

  async createBranch(
    owner: string,
    repo: string,
    branchName: string,
    fromRef: string,
  ): Promise<void> {
    await this.request(`/repositories/${owner}/${repo}/refs/branches`, {
      method: 'POST',
      body: JSON.stringify({
        name: branchName,
        target: { hash: fromRef },
      }),
    });
  }

  async commitFiles(
    owner: string,
    repo: string,
    branch: string,
    files: CommitFile[],
    message: string,
  ): Promise<CommitResult> {
    // Bitbucket uses form-data for file commits
    const formData = new FormData();
    formData.append('message', message);
    formData.append('branch', branch);

    for (const file of files) {
      formData.append(file.path, new Blob([file.content]), file.path);
    }

    const url = `${this.baseUrl}/repositories/${owner}/${repo}/src`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Bitbucket commit failed: ${response.status} - ${body}`);
    }

    // Bitbucket returns limited info on commit, fetch the latest
    const branchData = await this.request<{
      target: { hash: string; links: { html: { href: string } }; message: string };
    }>(`/repositories/${owner}/${repo}/refs/branches/${branch}`);

    return {
      sha: branchData.target.hash,
      url: branchData.target.links.html.href,
      message: branchData.target.message,
    };
  }

  async createPullRequest(
    owner: string,
    repo: string,
    title: string,
    body: string,
    head: string,
    base: string,
  ): Promise<PullRequestResult> {
    const data = await this.request<{
      id: number;
      links: { html: { href: string } };
      title: string;
    }>(`/repositories/${owner}/${repo}/pullrequests`, {
      method: 'POST',
      body: JSON.stringify({
        title,
        description: body,
        source: { branch: { name: head } },
        destination: { branch: { name: base } },
      }),
    });

    return {
      number: data.id,
      url: data.links.html.href,
      title: data.title,
    };
  }
}
