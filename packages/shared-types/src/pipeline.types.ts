import { PipelineTrigger, TestCheckType, TestStatus, TestRunStatus } from './enums';

export interface PipelineDto {
  id: string;
  projectId: string;
  name: string;
  trigger: PipelineTrigger;
  cronExpr: string | null;
  steps: PipelineStep[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PipelineStep {
  checkType: TestCheckType;
  order: number;
  config: Record<string, unknown>;
  enabled: boolean;
}

export interface TestRunDto {
  id: string;
  pipelineId: string;
  commitSha: string;
  branch: string;
  status: TestRunStatus;
  startedAt: string | null;
  finishedAt: string | null;
  triggeredBy: string | null;
  metadata: Record<string, unknown>;
  results?: TestResultDto[];
}

export interface TestResultDto {
  id: string;
  runId: string;
  checkType: TestCheckType;
  status: TestStatus;
  summary: string;
  details: Record<string, unknown>;
  artifactUrl: string | null;
  durationMs: number;
}

export interface CoverageSnapshotDto {
  id: string;
  resultId: string;
  linePct: number;
  branchPct: number;
  functionPct: number;
  uncovered: Record<string, unknown>;
}

export interface SSEEvent {
  type: 'run.started' | 'run.step.complete' | 'run.finished';
  runId: string;
  data: Record<string, unknown>;
}
