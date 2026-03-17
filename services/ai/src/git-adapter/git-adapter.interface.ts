export interface FileTreeEntry {
  path: string;
  type: 'file' | 'dir';
  size?: number;
}

export interface FileContent {
  path: string;
  content: string;
  encoding: string;
  size: number;
}

export interface CommitFile {
  path: string;
  content: string;
}

export interface CommitResult {
  sha: string;
  url: string;
  message: string;
}

export interface PullRequestResult {
  number: number;
  url: string;
  title: string;
}

export interface DiffEntry {
  filename: string;
  status: 'added' | 'modified' | 'removed' | 'renamed';
  additions: number;
  deletions: number;
  patch?: string;
}

export interface GitAdapter {
  /**
   * Get the file tree of the repository (recursive).
   * Optionally filter by path prefix.
   */
  getFileTree(
    owner: string,
    repo: string,
    branch: string,
    pathPrefix?: string,
  ): Promise<FileTreeEntry[]>;

  /**
   * Get content of a single file.
   */
  getFileContent(
    owner: string,
    repo: string,
    branch: string,
    filePath: string,
  ): Promise<FileContent>;

  /**
   * Get contents of multiple files at once.
   */
  getMultipleFiles(
    owner: string,
    repo: string,
    branch: string,
    filePaths: string[],
  ): Promise<FileContent[]>;

  /**
   * Get diff between two refs (commits, branches, tags).
   */
  getDiff(
    owner: string,
    repo: string,
    base: string,
    head: string,
  ): Promise<DiffEntry[]>;

  /**
   * Create a new branch from a given ref.
   */
  createBranch(
    owner: string,
    repo: string,
    branchName: string,
    fromRef: string,
  ): Promise<void>;

  /**
   * Commit multiple files to a branch.
   */
  commitFiles(
    owner: string,
    repo: string,
    branch: string,
    files: CommitFile[],
    message: string,
  ): Promise<CommitResult>;

  /**
   * Create a pull request.
   */
  createPullRequest(
    owner: string,
    repo: string,
    title: string,
    body: string,
    head: string,
    base: string,
  ): Promise<PullRequestResult>;
}
