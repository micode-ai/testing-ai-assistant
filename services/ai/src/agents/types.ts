export interface AgentInput {
  projectId: string;
  context: Record<string, unknown>;
}

export interface AgentOutput {
  result: string;
  model: string;
  tokensUsed: number;
  metadata?: Record<string, unknown>;
}

export interface TestGenInput extends AgentInput {
  context: {
    codeDiff: string;
    fileContents: Record<string, string>;
    existingTests: string[];
    testFramework: string;
    language: string;
  };
}

export interface TestGenState {
  input: TestGenInput;
  analysis: string;
  generatedTests: string;
  validationResult: { valid: boolean; issues: string[] };
  refinementCount: number;
  finalOutput: string;
  model: string;
  tokensUsed: number;
}

export interface BugDetectInput extends AgentInput {
  context: {
    codeDiff: string;
    testResults: TestResultEntry[];
    existingCodeContext: Record<string, string>;
  };
}

export interface TestResultEntry {
  testName: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  errorMessage?: string;
  errorStack?: string;
}

export interface BugDetectState {
  input: BugDetectInput;
  testAnalysis: string;
  codeAnalysis: string;
  crossReference: string;
  report: string;
  model: string;
  tokensUsed: number;
}

export interface BugReport {
  bugs: BugEntry[];
  summary: string;
}

export interface BugEntry {
  severity: 'critical' | 'high' | 'medium' | 'low';
  location: string;
  description: string;
  fixSuggestion: string;
}

export interface FlakyDetectInput extends AgentInput {
  context: {
    testHistory: TestRunHistory[];
    testResults: TestResultEntry[];
  };
}

export interface TestRunHistory {
  runId: string;
  timestamp: string;
  results: TestResultEntry[];
}

export interface FlakyDetectState {
  input: FlakyDetectInput;
  statisticalAnalysis: string;
  patternAnalysis: string;
  recommendations: string;
  model: string;
  tokensUsed: number;
}

export interface FlakyTestReport {
  flakyTests: FlakyTestEntry[];
  summary: string;
}

export interface FlakyTestEntry {
  testName: string;
  flakinessScore: number;
  pattern: 'timing-dependent' | 'order-dependent' | 'environment-dependent' | 'race-condition' | 'unknown';
  recommendation: string;
}

export interface CoverageAdviceInput extends AgentInput {
  context: {
    coverageData: CoverageData;
    uncoveredFiles: UncoveredFile[];
    codeContent: Record<string, string>;
  };
}

export interface CoverageData {
  totalLines: number;
  coveredLines: number;
  percentage: number;
  byFile: Record<string, { lines: number; covered: number; percentage: number }>;
}

export interface UncoveredFile {
  filePath: string;
  uncoveredLines: number[];
  totalLines: number;
}

export interface CoverageAdviceState {
  input: CoverageAdviceInput;
  analysis: string;
  recommendations: string;
  model: string;
  tokensUsed: number;
}

export interface CoverageAdviceReport {
  recommendations: CoverageRecommendation[];
  summary: string;
  prioritizedFiles: string[];
}

export interface CoverageRecommendation {
  filePath: string;
  priority: 'high' | 'medium' | 'low';
  testType: string;
  description: string;
  sampleTestStub: string;
}
