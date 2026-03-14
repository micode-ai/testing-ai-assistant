export enum OrgPlan {
  FREE = 'FREE',
  PRO = 'PRO',
  ENTERPRISE = 'ENTERPRISE',
}

export enum OrgMemberRole {
  ADMIN = 'ADMIN',
  MEMBER = 'MEMBER',
  VIEWER = 'VIEWER',
}

export enum OrgMemberStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export enum OAuthProvider {
  GITHUB = 'GITHUB',
  GITLAB = 'GITLAB',
  BITBUCKET = 'BITBUCKET',
}

export enum TestStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  PASSED = 'PASSED',
  FAILED = 'FAILED',
  SKIPPED = 'SKIPPED',
  CANCELLED = 'CANCELLED',
}

export enum TestCheckType {
  UNIT = 'UNIT',
  INTEGRATION = 'INTEGRATION',
  E2E = 'E2E',
  LOAD = 'LOAD',
  LINT = 'LINT',
  SAST = 'SAST',
  DAST = 'DAST',
  DEPENDENCY_AUDIT = 'DEPENDENCY_AUDIT',
  AI_REVIEW = 'AI_REVIEW',
}

export enum PipelineTrigger {
  PUSH = 'PUSH',
  PULL_REQUEST = 'PULL_REQUEST',
  SCHEDULE = 'SCHEDULE',
  MANUAL = 'MANUAL',
}

export enum TestRunStatus {
  QUEUED = 'QUEUED',
  RUNNING = 'RUNNING',
  PASSED = 'PASSED',
  FAILED = 'FAILED',
  ERRORED = 'ERRORED',
  CANCELLED = 'CANCELLED',
}

export enum RepoProvider {
  GITHUB = 'GITHUB',
  GITLAB = 'GITLAB',
  BITBUCKET = 'BITBUCKET',
}
