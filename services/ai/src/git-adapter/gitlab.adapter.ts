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

export class GitLabAdapter implements GitAdapter {
  private readonly logger = new Logger(GitLabAdapter.name);
  private readonly baseUrl: string;

  constructor(
    private readonly token: string,
    baseUrl = 'https://gitlab.com',
  ) {
    this.baseUrl = `${baseUrl}/api/v4`;
  }

  private async request<T>(
    path: string,
    options: RequestInit = {},
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'PRIVATE-TOKEN': this.token,
        'Content-Type': 'application/json',
        ...((options.headers as Record<string, string>) || {}),
      },
    });

    if (!response.ok) {
      const body = await response.text();
      this.logger.error(`GitLab API error: ${response.status} ${path} - ${body}`);
      throw new Error(`GitLab API error: ${response.status} - ${body}`);
    }

    return response.json() as Promise<T>;
  }

  private encodeProject(owner: string, repo: string): string {
    return encodeURIComponent(`${owner}/${repo}`);
  }

  async getFileTree(
    owner: string,
    repo: string,
    branch: string,
    pathPrefix?: string,
  ): Promise<FileTreeEntry[]> {
    const projectId = this.encodeProject(owner, repo);
    const entries: FileTreeEntry[] = [];
    let page = 1;
    const perPage = 100;

    while (true) {
      const params = new URLSearchParams({
        ref: branch,
        recursive: 'true',
        per_page: String(perPage),
        page: String(page),
      });
      if (pathPrefix) params.set('path', pathPrefix);

      const items = await this.request<
        Array<{ path: string; type: string; size?: number }>
      >(`/projects/${projectId}/repository/tree?${params}`);

      if (items.length === 0) break;

      for (const item of items) {
        const ignoredPrefixes = [
          'node_modules/',
          '.git/',
          'dist/',
          'build/',
          '.next/',
          'coverage/',
        ];
        if (ignoredPrefixes.some((p) => item.path.startsWith(p))) continue;

        entries.push({
          path: item.path,
          type: item.type === 'blob' ? 'file' : 'dir',
          size: item.size,
        });
      }

      if (items.length < perPage) break;
      page++;
    }

    return entries;
  }

  async getFileContent(
    owner: string,
    repo: string,
    branch: string,
    filePath: string,
  ): Promise<FileContent> {
    const projectId = this.encodeProject(owner, repo);
    const encodedPath = encodeURIComponent(filePath);

    const data = await this.request<{
      file_path: string;
      content: string;
      encoding: string;
      size: number;
    }>(`/projects/${projectId}/repository/files/${encodedPath}?ref=${branch}`);

    const content =
      data.encoding === 'base64'
        ? Buffer.from(data.content, 'base64').toString('utf-8')
        : data.content;

    return {
      path: data.file_path,
      content,
      encoding: 'utf-8',
      size: data.size,
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
    const projectId = this.encodeProject(owner, repo);
    const data = await this.request<
      Array<{
        old_path: string;
        new_path: string;
        new_file: boolean;
        renamed_file: boolean;
        deleted_file: boolean;
        diff: string;
      }>
    >(`/projects/${projectId}/repository/compare?from=${base}&to=${head}`);

    return data.map((f) => {
      let status: DiffEntry['status'] = 'modified';
      if (f.new_file) status = 'added';
      else if (f.deleted_file) status = 'removed';
      else if (f.renamed_file) status = 'renamed';

      return {
        filename: f.new_path,
        status,
        additions: 0,
        deletions: 0,
        patch: f.diff,
      };
    });
  }

  async createBranch(
    owner: string,
    repo: string,
    branchName: string,
    fromRef: string,
  ): Promise<void> {
    const projectId = this.encodeProject(owner, repo);
    await this.request(`/projects/${projectId}/repository/branches`, {
      method: 'POST',
      body: JSON.stringify({ branch: branchName, ref: fromRef }),
    });
  }

  async commitFiles(
    owner: string,
    repo: string,
    branch: string,
    files: CommitFile[],
    message: string,
  ): Promise<CommitResult> {
    const projectId = this.encodeProject(owner, repo);

    const actions = files.map((f) => ({
      action: 'create' as const,
      file_path: f.path,
      content: f.content,
    }));

    const data = await this.request<{
      id: string;
      web_url: string;
      message: string;
    }>(`/projects/${projectId}/repository/commits`, {
      method: 'POST',
      body: JSON.stringify({
        branch,
        commit_message: message,
        actions,
      }),
    });

    return {
      sha: data.id,
      url: data.web_url,
      message: data.message,
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
    const projectId = this.encodeProject(owner, repo);

    const data = await this.request<{
      iid: number;
      web_url: string;
      title: string;
    }>(`/projects/${projectId}/merge_requests`, {
      method: 'POST',
      body: JSON.stringify({
        title,
        description: body,
        source_branch: head,
        target_branch: base,
      }),
    });

    return {
      number: data.iid,
      url: data.web_url,
      title: data.title,
    };
  }
}
