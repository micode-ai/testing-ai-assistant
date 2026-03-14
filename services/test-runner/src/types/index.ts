export interface StepResult {
  status: 'passed' | 'failed' | 'errored';
  summary: string;
  details: Record<string, unknown>;
  durationMs: number;
}

export interface PipelineInput {
  runId: string;
  pipelineId: string;
  projectId: string;
  repoUrl: string;
  repoOwner: string;
  repoName: string;
  commitSha: string;
  branch: string;
  steps: PipelineStepConfig[];
}

export interface PipelineStepConfig {
  checkType: string;
  order: number;
  config: Record<string, unknown>;
}

// --- Phase 3 types ---

export interface PlaywrightConfig {
  baseUrl?: string;
  browsers: string[];
  headless: boolean;
  testDir: string;
  timeout: number;
}

export interface CoverageResult {
  linePct: number;
  branchPct: number;
  functionPct: number;
  uncovered: { file: string; lines: number[] }[];
}

export interface CoverageDiff {
  lineDelta: number;
  branchDelta: number;
  functionDelta: number;
  improved: boolean;
}

export interface LoadTestConfig {
  script: string;
  vus: number;
  duration: string;
  thresholds: Record<string, string[]>;
}

export interface ArtifactInfo {
  name: string;
  url: string;
  type: 'screenshot' | 'video' | 'coverage-report' | 'log' | 'other';
  sizeBytes?: number;
}
