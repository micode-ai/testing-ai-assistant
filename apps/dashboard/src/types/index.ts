export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  createdAt: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: 'FREE' | 'PRO' | 'ENTERPRISE';
  createdAt: string;
  memberCount?: number;
}

export interface Membership {
  id: string;
  userId: string;
  orgId: string;
  role: 'ADMIN' | 'MEMBER' | 'VIEWER';
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  requestedAt: string;
  resolvedAt: string | null;
}

export type RepoProvider = 'GITHUB' | 'GITLAB' | 'BITBUCKET';

export interface Project {
  id: string;
  orgId: string;
  name: string;
  repoUrl: string;
  repoProvider: RepoProvider;
  defaultBranch: string;
  webhookActive: boolean;
  webhookId: string | null;
  createdAt: string;
  updatedAt: string;
}

export type TriggerType = 'PUSH' | 'PULL_REQUEST' | 'SCHEDULE' | 'MANUAL';

export type CheckType = 'LINT' | 'UNIT_TEST' | 'INTEGRATION_TEST' | 'E2E_TEST' | 'COVERAGE' | 'SECURITY_SCAN';

export interface PipelineStep {
  id: string;
  pipelineId: string;
  name: string;
  checkType: CheckType;
  config: Record<string, unknown>;
  order: number;
}

export interface Pipeline {
  id: string;
  projectId: string;
  name: string;
  triggerType: TriggerType;
  cronExpression: string | null;
  enabled: boolean;
  steps: PipelineStep[];
  createdAt: string;
  updatedAt: string;
}

export type RunStatus = 'QUEUED' | 'RUNNING' | 'PASSED' | 'FAILED' | 'ERRORED' | 'CANCELLED';

export interface TestRun {
  id: string;
  pipelineId: string;
  status: RunStatus;
  commitSha: string;
  branch: string;
  triggeredBy: string;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  steps: TestRunStep[];
}

export interface TestRunStep {
  id: string;
  runId: string;
  pipelineStepId: string;
  name: string;
  checkType: CheckType;
  status: RunStatus;
  startedAt: string | null;
  finishedAt: string | null;
  duration: number | null;
  details: Record<string, unknown> | null;
}

export interface TestResult {
  id: string;
  runId: string;
  stepId: string;
  testName: string;
  status: 'PASSED' | 'FAILED' | 'SKIPPED';
  duration: number;
  errorMessage: string | null;
  stackTrace: string | null;
}

export interface CoverageSnapshot {
  id: string;
  runId: string;
  lineCoverage: number;
  branchCoverage: number;
  functionCoverage: number;
  statementCoverage: number;
  createdAt: string;
}

export type GenerationType = 'TEST_GEN' | 'BUG_DETECT' | 'FLAKY_DETECT' | 'COVERAGE_ADVICE' | 'PROJECT_ANALYSIS' | 'TEST_PROPOSAL';

export type TestGenSessionStatus =
  | 'ANALYZING'
  | 'PROPOSING'
  | 'AWAITING_APPROVAL'
  | 'GENERATING'
  | 'REVIEW'
  | 'COMMITTING'
  | 'COMMITTED'
  | 'FAILED';

export interface TestGenSession {
  id: string;
  projectId: string;
  status: TestGenSessionStatus;
  profileId: string | null;
  proposal: TestProposal | null;
  approvedItems: TestProposalItem[] | null;
  generatedTests: GeneratedTestFile[] | null;
  branchName: string | null;
  commitSha: string | null;
  commitUrl: string | null;
  pullRequestUrl: string | null;
  totalTokensUsed: number;
  metadata: TestGenProgress | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TestGenProgress {
  currentTest?: number;
  totalTests?: number;
  currentFile?: string;
  done?: boolean;
}

export interface TestProposal {
  items: TestProposalItem[];
  summary: string;
  estimatedTokens: number;
}

export interface TestProposalItem {
  id: string;
  targetFile: string;
  testFilePath: string;
  testType: 'unit' | 'integration' | 'e2e';
  description: string;
  rationale: string;
  priority: 'high' | 'medium' | 'low';
  estimatedTests: number;
}

export interface GeneratedTestFile {
  path: string;
  content: string;
}

export interface ProjectProfile {
  id: string;
  projectId: string;
  language: string;
  testFramework: string;
  packageManager: string | null;
  structure: {
    sourceDirectories: string[];
    testDirectories: string[];
    configFiles: string[];
    totalFiles: number;
  };
  testPatterns: {
    filePattern: string;
    existingTests: string[];
    estimatedCoverage: string;
  };
  dependencies: {
    runtime: string[];
    devDependencies: string[];
    testRelated: string[];
  };
  analyzedAt: string;
}

export interface CommitResult {
  branchName: string;
  commitSha: string;
  commitUrl: string;
  pullRequestUrl?: string;
}

export interface AIGeneration {
  id: string;
  projectId: string;
  type: GenerationType;
  inputContext: Record<string, unknown>;
  output: string;
  model: string;
  tokensUsed: number;
  accepted: boolean | null;
  feedback: string | null;
  createdAt: string;
}

export interface GenerationStats {
  total: number;
  byType: Record<GenerationType, number>;
  acceptanceRate: number;
  totalTokens: number;
}

export type NotificationChannel = 'EMAIL' | 'SLACK' | 'TELEGRAM';

export type NotificationStatus = 'SENT' | 'FAILED' | 'PENDING';

export interface NotificationConfig {
  id: string;
  orgId: string;
  channel: NotificationChannel;
  event: string;
  config: Record<string, unknown>;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationLog {
  id: string;
  configId: string;
  event: string;
  channel: NotificationChannel;
  status: NotificationStatus;
  payload: Record<string, unknown>;
  errorMessage: string | null;
  sentAt: string;
}
