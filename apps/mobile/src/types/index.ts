export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  plan: 'free' | 'pro' | 'enterprise';
  memberCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  organizationId: string;
  name: string;
  repoUrl: string;
  provider: 'github' | 'gitlab' | 'bitbucket';
  defaultBranch: string;
  isActive: boolean;
  webhookActive: boolean;
  lastRunAt?: string;
  lastRunStatus?: TestRunStatus;
  createdAt: string;
  updatedAt: string;
}

export type TestRunStatus =
  | 'QUEUED'
  | 'RUNNING'
  | 'PASSED'
  | 'FAILED'
  | 'CANCELLED'
  | 'TIMED_OUT';

export interface TestRun {
  id: string;
  projectId: string;
  projectName?: string;
  pipelineId: string;
  branch: string;
  commitSha: string;
  commitMessage?: string;
  status: TestRunStatus;
  triggerType: 'push' | 'pull_request' | 'manual' | 'scheduled';
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  duration?: number;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
  steps?: TestRunStep[];
}

export interface TestRunStep {
  id: string;
  name: string;
  status: TestRunStatus;
  duration?: number;
  order: number;
  results?: TestResult[];
  startedAt?: string;
  completedAt?: string;
}

export interface TestResult {
  id: string;
  testName: string;
  suiteName: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  errorMessage?: string;
  stackTrace?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
}

export interface ApiError {
  message: string;
  statusCode: number;
  error?: string;
}
