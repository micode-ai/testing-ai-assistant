/**
 * Maps between workflow lowercase check types and Prisma enum values.
 */

const WORKFLOW_TO_PRISMA: Record<string, string> = {
  unit: 'UNIT',
  integration: 'INTEGRATION',
  e2e: 'E2E',
  load: 'LOAD',
  lint: 'LINT',
  sast: 'SAST',
  dast: 'DAST',
  dep_audit: 'DEPENDENCY_AUDIT',
  ai_review: 'AI_REVIEW',
  // Also accept uppercase directly
  UNIT: 'UNIT',
  INTEGRATION: 'INTEGRATION',
  E2E: 'E2E',
  LOAD: 'LOAD',
  LINT: 'LINT',
  SAST: 'SAST',
  DAST: 'DAST',
  DEPENDENCY_AUDIT: 'DEPENDENCY_AUDIT',
  AI_REVIEW: 'AI_REVIEW',
  // Preparation phases
  repository_setup: 'REPOSITORY_SETUP',
  REPOSITORY_SETUP: 'REPOSITORY_SETUP',
  coverage: 'COVERAGE',
  // Dashboard check types
  UNIT_TEST: 'UNIT',
  INTEGRATION_TEST: 'INTEGRATION',
  E2E_TEST: 'E2E',
  COVERAGE: 'COVERAGE',
  SECURITY_SCAN: 'SAST',
};

const PRISMA_TO_WORKFLOW: Record<string, string> = {
  UNIT: 'unit',
  INTEGRATION: 'integration',
  E2E: 'e2e',
  LOAD: 'load',
  LINT: 'lint',
  SAST: 'sast',
  DAST: 'dast',
  DEPENDENCY_AUDIT: 'dep_audit',
  AI_REVIEW: 'ai_review',
};

const STATUS_TO_PRISMA: Record<string, string> = {
  passed: 'PASSED',
  failed: 'FAILED',
  errored: 'FAILED',
  skipped: 'SKIPPED',
  cancelled: 'CANCELLED',
  pending: 'PENDING',
  running: 'RUNNING',
  PASSED: 'PASSED',
  FAILED: 'FAILED',
  SKIPPED: 'SKIPPED',
  CANCELLED: 'CANCELLED',
  PENDING: 'PENDING',
  RUNNING: 'RUNNING',
};

export function toPrismaCheckType(workflowType: string): string {
  return WORKFLOW_TO_PRISMA[workflowType] || workflowType.toUpperCase();
}

export function toWorkflowCheckType(prismaType: string): string {
  return PRISMA_TO_WORKFLOW[prismaType] || prismaType.toLowerCase();
}

export function toPrismaStatus(workflowStatus: string): string {
  return STATUS_TO_PRISMA[workflowStatus] || workflowStatus.toUpperCase();
}
