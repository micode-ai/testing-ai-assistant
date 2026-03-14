export interface RepoInfo {
  id: string;
  name: string;
  fullName: string;
  description: string | null;
  private: boolean;
  defaultBranch: string;
  cloneUrl: string;
  htmlUrl: string;
  language: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Branch {
  name: string;
  sha: string;
  protected: boolean;
}

export interface CommitInfo {
  sha: string;
  message: string;
  author: {
    name: string;
    email: string;
    date: string;
  };
  committer: {
    name: string;
    email: string;
    date: string;
  };
  url: string;
  parents: string[];
}

export interface WebhookInfo {
  id: string;
  url: string;
  events: string[];
  active: boolean;
}

export interface PullRequest {
  number: number;
  title: string;
  state: string;
  sourceBranch: string;
  targetBranch: string;
  author: {
    login: string;
    avatarUrl?: string;
  };
}

export interface CommitStatusInput {
  state: 'pending' | 'success' | 'failure' | 'error';
  context: string;
  description?: string;
  targetUrl?: string;
}

export interface GitProvider {
  getRepository(owner: string, repo: string): Promise<RepoInfo>;
  getBranches(owner: string, repo: string): Promise<Branch[]>;
  getCommit(owner: string, repo: string, sha: string): Promise<CommitInfo>;
  getDiff(owner: string, repo: string, base: string, head: string): Promise<string>;
  getFileContent(owner: string, repo: string, path: string, ref?: string): Promise<string>;
  createWebhook(
    owner: string,
    repo: string,
    url: string,
    secret: string,
    events: string[],
  ): Promise<WebhookInfo>;
  deleteWebhook(owner: string, repo: string, webhookId: string): Promise<void>;
  verifyWebhookSignature(payload: string, signature: string, secret: string): boolean;
  listPullRequests(
    owner: string,
    repo: string,
    state?: 'open' | 'closed' | 'all',
  ): Promise<PullRequest[]>;
  createCommitStatus(
    owner: string,
    repo: string,
    sha: string,
    status: CommitStatusInput,
  ): Promise<void>;
}
