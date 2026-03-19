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

// --- Checklist Generation ---

export interface ChecklistGenInput extends AgentInput {
  context: {
    repoUrl?: string;
    targetUrl?: string;
    appDescription?: string;
    existingFeatures?: string[];
  };
}

export interface ChecklistGenState {
  input: ChecklistGenInput;
  analysis: string;
  checklist: string;
  validation: { valid: boolean; issues: string[] };
  refinementCount: number;
  finalOutput: string;
  model: string;
  tokensUsed: number;
}

export interface ChecklistTestGenInput extends AgentInput {
  context: {
    checklistItem: {
      title: string;
      description: string;
      expectedBehavior: string;
    };
    targetUrl: string;
    framework: string;
  };
}

export interface ChecklistTestGenState {
  input: ChecklistTestGenInput;
  analysis: string;
  generatedTest: string;
  validationResult: { valid: boolean; issues: string[] };
  refinementCount: number;
  finalOutput: string;
  model: string;
  tokensUsed: number;
}

export interface ChecklistItemChatInput extends AgentInput {
  context: {
    item: {
      title: string;
      description: string;
      expectedBehavior: string;
    };
    note: string;
    messages: { role: string; content: string }[];
  };
}

export interface CoverageRecommendation {
  filePath: string;
  priority: 'high' | 'medium' | 'low';
  testType: string;
  description: string;
  sampleTestStub: string;
}

// --- Project Analysis ---

export interface ProjectAnalysisInput extends AgentInput {
  context: {
    fileTree: string[];
    configFiles: Record<string, string>; // path → content
    existingTestFiles: string[];
    repoProvider: string;
  };
}

export interface ProjectProfile {
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
    filePattern: string; // e.g. "*.spec.ts", "*.test.js"
    existingTests: string[];
    estimatedCoverage: string;
  };
  dependencies: {
    runtime: string[];
    devDependencies: string[];
    testRelated: string[];
  };
}

// --- Test Proposal ---

export interface TestProposalInput extends AgentInput {
  context: {
    profile: ProjectProfile;
    fileContents: Record<string, string>; // source files to analyze
    focusArea?: string; // optional user-specified focus
    recentChanges?: string; // diff or description of recent changes
    locale?: string; // UI language code (en, ru, pl) for localized output
  };
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

// --- Approved Test Generation ---

export interface ApprovedTestGenInput extends AgentInput {
  context: {
    profile: ProjectProfile;
    approvedItems: TestProposalItem[];
    fileContents: Record<string, string>;
  };
}
