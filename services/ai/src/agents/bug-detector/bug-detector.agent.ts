import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StateGraph, END, START, Annotation } from '@langchain/langgraph';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { BaseAgent } from '../base-agent';
import { AgentOutput, BugDetectInput, BugDetectState } from '../types';

const BugDetectAnnotation = Annotation.Root({
  input: Annotation<BugDetectInput>,
  testAnalysis: Annotation<string>({ reducer: (_, b) => b, default: () => '' }),
  codeAnalysis: Annotation<string>({ reducer: (_, b) => b, default: () => '' }),
  crossReference: Annotation<string>({ reducer: (_, b) => b, default: () => '' }),
  report: Annotation<string>({ reducer: (_, b) => b, default: () => '' }),
  model: Annotation<string>({ reducer: (_, b) => b, default: () => '' }),
  tokensUsed: Annotation<number>({ reducer: (a, b) => a + b, default: () => 0 }),
});

type BugDetectGraphState = typeof BugDetectAnnotation.State;

export class BugDetectorAgent extends BaseAgent {
  private readonly logger = new Logger(BugDetectorAgent.name);
  private graph: ReturnType<StateGraph<typeof BugDetectAnnotation>['compile']>;

  constructor(configService: ConfigService) {
    super(configService);
    this.graph = this.buildGraph();
  }

  private getLanguageName(locale?: string): string {
    switch (locale) {
      case 'ru': return 'Russian';
      case 'pl': return 'Polish';
      default: return 'English';
    }
  }

  private buildGraph() {
    const workflow = new StateGraph(BugDetectAnnotation)
      .addNode('analyzeTestResults', this.analyzeTestResults.bind(this))
      .addNode('analyzeCodeDiff', this.analyzeCodeDiff.bind(this))
      .addNode('crossReferenceNode', this.crossReference.bind(this))
      .addNode('generateReport', this.generateReport.bind(this))
      .addEdge(START, 'analyzeTestResults')
      .addEdge('analyzeTestResults', 'analyzeCodeDiff')
      .addEdge('analyzeCodeDiff', 'crossReferenceNode')
      .addEdge('crossReferenceNode', 'generateReport')
      .addEdge('generateReport', END);

    return workflow.compile() as any;
  }

  async run(input: BugDetectInput): Promise<AgentOutput> {
    this.logger.log(`Running bug detector for project ${input.projectId}`);

    const initialState: Partial<BugDetectGraphState> = {
      input,
      testAnalysis: '',
      codeAnalysis: '',
      crossReference: '',
      report: '',
      model: '',
      tokensUsed: 0,
    };

    const result = await this.graph.invoke(initialState);

    return {
      result: result.report,
      model: result.model,
      tokensUsed: result.tokensUsed,
    };
  }

  private async analyzeTestResults(state: BugDetectGraphState): Promise<Partial<BugDetectGraphState>> {
    this.logger.debug('Analyzing test results...');

    const { context } = state.input;
    const lang = this.getLanguageName(context.locale);
    const testResults = Array.isArray(context.testResults) ? context.testResults : [];
    const failedTests = testResults.filter((t) => t.status === 'failed');

    const response = await this.model.invoke([
      new SystemMessage(
        `You are an expert bug detective. Analyze the following test failure results. ` +
        `Identify patterns in the failures: common error types, related test areas, timing patterns. ` +
        `Write your analysis in ${lang}. Output a structured analysis of failure patterns.`,
      ),
      new HumanMessage(
        `Failed Tests (${failedTests.length} of ${testResults.length}):\n` +
        JSON.stringify(failedTests, null, 2),
      ),
    ]);

    const tokensUsed = response.usage_metadata?.total_tokens ?? 0;

    return {
      testAnalysis: typeof response.content === 'string' ? response.content : JSON.stringify(response.content),
      model: this.model.modelName || 'o3',
      tokensUsed,
    };
  }

  private async analyzeCodeDiff(state: BugDetectGraphState): Promise<Partial<BugDetectGraphState>> {
    this.logger.debug('Analyzing code diff for bug patterns...');

    const { context } = state.input;
    const lang = this.getLanguageName(context.locale);
    const response = await this.model.invoke([
      new SystemMessage(
        `You are an expert code reviewer specializing in bug detection. ` +
        `Analyze the following code diff for common bug patterns: ` +
        `null pointer dereferences, off-by-one errors, race conditions, resource leaks, ` +
        `incorrect error handling, type mismatches, missing validations. ` +
        `Write your analysis in ${lang}. Output a structured analysis of potential bugs found.`,
      ),
      new HumanMessage(
        `Code Diff:\n${context.codeDiff}\n\n` +
        `Existing Code Context:\n${JSON.stringify(context.existingCodeContext, null, 2)}`,
      ),
    ]);

    const tokensUsed = response.usage_metadata?.total_tokens ?? 0;

    return {
      codeAnalysis: typeof response.content === 'string' ? response.content : JSON.stringify(response.content),
      tokensUsed,
    };
  }

  private async crossReference(state: BugDetectGraphState): Promise<Partial<BugDetectGraphState>> {
    this.logger.debug('Cross-referencing failures with code changes...');

    const lang = this.getLanguageName(state.input.context.locale);
    const response = await this.model.invoke([
      new SystemMessage(
        `You are an expert at correlating test failures with code changes. ` +
        `Cross-reference the test failure analysis with the code analysis to determine: ` +
        `1. Which code changes likely caused which test failures\n` +
        `2. Whether bugs found in code review are confirmed by test failures\n` +
        `3. Any test failures that might be caused by issues NOT in the code diff\n` +
        `Write your analysis in ${lang}. Output a structured cross-reference mapping.`,
      ),
      new HumanMessage(
        `Test Analysis:\n${state.testAnalysis}\n\n` +
        `Code Analysis:\n${state.codeAnalysis}`,
      ),
    ]);

    const tokensUsed = response.usage_metadata?.total_tokens ?? 0;

    return {
      crossReference: typeof response.content === 'string' ? response.content : JSON.stringify(response.content),
      tokensUsed,
    };
  }

  private async generateReport(state: BugDetectGraphState): Promise<Partial<BugDetectGraphState>> {
    this.logger.debug('Generating bug report...');

    const lang = this.getLanguageName(state.input.context.locale);
    const response = await this.model.invoke([
      new SystemMessage(
        `You are a senior QA engineer writing a bug report for a general audience (not just developers). ` +
        `Based on all the analysis, generate a comprehensive bug report in JSON format:\n` +
        `{\n` +
        `  "bugs": [{\n` +
        `    "severity": "critical|high|medium|low",\n` +
        `    "location": "file:line",\n` +
        `    "title": "short human-readable title",\n` +
        `    "description": "clear explanation of the problem understandable by a non-developer",\n` +
        `    "impact": "what could go wrong if this is not fixed",\n` +
        `    "fixSuggestion": "concrete steps to fix"\n` +
        `  }],\n` +
        `  "summary": "brief overview of all findings",\n` +
        `  "totalBugs": number,\n` +
        `  "criticalCount": number,\n` +
        `  "highCount": number,\n` +
        `  "mediumCount": number,\n` +
        `  "lowCount": number\n` +
        `}\n` +
        `IMPORTANT: Write ALL text fields (title, description, impact, fixSuggestion, summary) in ${lang}. ` +
        `Keep only file paths, code snippets, and JSON keys in English.\n` +
        `Order bugs by severity (critical first). Be specific about locations and fixes.`,
      ),
      new HumanMessage(
        `Test Analysis:\n${state.testAnalysis}\n\n` +
        `Code Analysis:\n${state.codeAnalysis}\n\n` +
        `Cross Reference:\n${state.crossReference}`,
      ),
    ]);

    const tokensUsed = response.usage_metadata?.total_tokens ?? 0;

    return {
      report: typeof response.content === 'string' ? response.content : JSON.stringify(response.content),
      tokensUsed,
    };
  }
}
