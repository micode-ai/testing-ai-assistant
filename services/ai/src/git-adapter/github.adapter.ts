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

export class GitHubAdapter implements GitAdapter {
  private readonly logger = new Logger(GitHubAdapter.name);
  private readonly baseUrl = 'https://api.github.com';

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
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
        ...((options.headers as Record<string, string>) || {}),
      },
    });

    if (!response.ok) {
      const body = await response.text();
      this.logger.error(`GitHub API error: ${response.status} ${path} - ${body}`);
      throw new Error(`GitHub API error: ${response.status} - ${body}`);
    }

    return response.json() as Promise<T>;
  }

  async getFileTree(
    owner: string,
    repo: string,
    branch: string,
    pathPrefix?: string,
  ): Promise<FileTreeEntry[]> {
    const data = await this.request<{
      tree: Array<{ path: string; type: string; size?: number }>;
      truncated: boolean;
    }>(`/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`);

    if (data.truncated) {
      this.logger.warn(`File tree for ${owner}/${repo} was truncated by GitHub API`);
    }

    let entries = data.tree
      .filter((item) => item.type === 'blob' || item.type === 'tree')
      .map((item) => ({
        path: item.path,
        type: (item.type === 'blob' ? 'file' : 'dir') as 'file' | 'dir',
        size: item.size,
      }));

    if (pathPrefix) {
      entries = entries.filter((e) => e.path.startsWith(pathPrefix));
    }

    // Filter out common non-essential paths
    const ignoredPrefixes = [
      'node_modules/',
      '.git/',
      'dist/',
      'build/',
      '.next/',
      'coverage/',
      '.cache/',
      '__pycache__/',
      '.venv/',
      'vendor/',
      'target/',
    ];
    entries = entries.filter(
      (e) => !ignoredPrefixes.some((prefix) => e.path.startsWith(prefix)),
    );

    return entries;
  }

  async getFileContent(
    owner: string,
    repo: string,
    branch: string,
    filePath: string,
  ): Promise<FileContent> {
    const data = await this.request<{
      content: string;
      encoding: string;
      size: number;
      path: string;
    }>(`/repos/${owner}/${repo}/contents/${filePath}?ref=${branch}`);

    const content =
      data.encoding === 'base64'
        ? Buffer.from(data.content, 'base64').toString('utf-8')
        : data.content;

    return {
      path: data.path,
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

    // Fetch files in parallel with concurrency limit
    const batchSize = 5;
    for (let i = 0; i < filePaths.length; i += batchSize) {
      const batch = filePaths.slice(i, i + batchSize);
      const batchResults = await Promise.allSettled(
        batch.map((fp) => this.getFileContent(owner, repo, branch, fp)),
      );

      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          this.logger.warn(`Failed to fetch file: ${result.reason}`);
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
      files: Array<{
        filename: string;
        status: string;
        additions: number;
        deletions: number;
        patch?: string;
      }>;
    }>(`/repos/${owner}/${repo}/compare/${base}...${head}`);

    return data.files.map((f) => ({
      filename: f.filename,
      status: f.status as DiffEntry['status'],
      additions: f.additions,
      deletions: f.deletions,
      patch: f.patch,
    }));
  }

  async createBranch(
    owner: string,
    repo: string,
    branchName: string,
    fromRef: string,
  ): Promise<void> {
    // Get SHA of the source ref
    const refData = await this.request<{ object: { sha: string } }>(
      `/repos/${owner}/${repo}/git/ref/heads/${fromRef}`,
    );

    await this.request(`/repos/${owner}/${repo}/git/refs`, {
      method: 'POST',
      body: JSON.stringify({
        ref: `refs/heads/${branchName}`,
        sha: refData.object.sha,
      }),
    });

    this.logger.log(`Created branch ${branchName} from ${fromRef} in ${owner}/${repo}`);
  }

  async commitFiles(
    owner: string,
    repo: string,
    branch: string,
    files: CommitFile[],
    message: string,
  ): Promise<CommitResult> {
    // 1. Get the latest commit SHA on the branch
    const refData = await this.request<{ object: { sha: string } }>(
      `/repos/${owner}/${repo}/git/ref/heads/${branch}`,
    );
    const latestCommitSha = refData.object.sha;

    // 2. Get the tree SHA of the latest commit
    const commitData = await this.request<{ tree: { sha: string } }>(
      `/repos/${owner}/${repo}/git/commits/${latestCommitSha}`,
    );
    const baseTreeSha = commitData.tree.sha;

    // 3. Create blobs for each file
    const treeEntries = await Promise.all(
      files.map(async (file) => {
        const blobData = await this.request<{ sha: string }>(
          `/repos/${owner}/${repo}/git/blobs`,
          {
            method: 'POST',
            body: JSON.stringify({
              content: file.content,
              encoding: 'utf-8',
            }),
          },
        );
        return {
          path: file.path,
          mode: '100644' as const,
          type: 'blob' as const,
          sha: blobData.sha,
        };
      }),
    );

    // 4. Create a new tree
    const newTree = await this.request<{ sha: string }>(
      `/repos/${owner}/${repo}/git/trees`,
      {
        method: 'POST',
        body: JSON.stringify({
          base_tree: baseTreeSha,
          tree: treeEntries,
        }),
      },
    );

    // 5. Create the commit
    const newCommit = await this.request<{
      sha: string;
      html_url: string;
      message: string;
    }>(`/repos/${owner}/${repo}/git/commits`, {
      method: 'POST',
      body: JSON.stringify({
        message,
        tree: newTree.sha,
        parents: [latestCommitSha],
      }),
    });

    // 6. Update the branch ref
    await this.request(`/repos/${owner}/${repo}/git/refs/heads/${branch}`, {
      method: 'PATCH',
      body: JSON.stringify({ sha: newCommit.sha }),
    });

    this.logger.log(`Committed ${files.length} files to ${branch} in ${owner}/${repo}`);

    return {
      sha: newCommit.sha,
      url: newCommit.html_url,
      message: newCommit.message,
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
      number: number;
      html_url: string;
      title: string;
    }>(`/repos/${owner}/${repo}/pulls`, {
      method: 'POST',
      body: JSON.stringify({ title, body, head, base }),
    });

    this.logger.log(`Created PR #${data.number} in ${owner}/${repo}`);

    return {
      number: data.number,
      url: data.html_url,
      title: data.title,
    };
  }
}
