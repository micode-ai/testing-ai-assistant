import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StateGraph, END, START, Annotation } from '@langchain/langgraph';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { BaseAgent } from '../base-agent';
import { AgentOutput, FlakyDetectInput, FlakyDetectState } from '../types';

const FlakyDetectAnnotation = Annotation.Root({
  input: Annotation<FlakyDetectInput>,
  statisticalAnalysis: Annotation<string>({ reducer: (_, b) => b, default: () => '' }),
  patternAnalysis: Annotation<string>({ reducer: (_, b) => b, default: () => '' }),
  recommendations: Annotation<string>({ reducer: (_, b) => b, default: () => '' }),
  model: Annotation<string>({ reducer: (_, b) => b, default: () => '' }),
  tokensUsed: Annotation<number>({ reducer: (a, b) => a + b, default: () => 0 }),
});

type FlakyDetectGraphState = typeof FlakyDetectAnnotation.State;

export class FlakyDetectorAgent extends BaseAgent {
  private readonly logger = new Logger(FlakyDetectorAgent.name);
  private graph: ReturnType<StateGraph<typeof FlakyDetectAnnotation>['compile']>;

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
    const workflow = new StateGraph(FlakyDetectAnnotation)
      .addNode('statisticalAnalysisNode', this.statisticalAnalysis.bind(this))
      .addNode('patternDetection', this.patternDetection.bind(this))
      .addNode('generateRecommendations', this.generateRecommendations.bind(this))
      .addEdge(START, 'statisticalAnalysisNode')
      .addEdge('statisticalAnalysisNode', 'patternDetection')
      .addEdge('patternDetection', 'generateRecommendations')
      .addEdge('generateRecommendations', END);

    return workflow.compile() as any;
  }

  async run(input: FlakyDetectInput): Promise<AgentOutput> {
    this.logger.log(`Running flaky test detector for project ${input.projectId}`);

    const initialState: Partial<FlakyDetectGraphState> = {
      input,
      statisticalAnalysis: '',
      patternAnalysis: '',
      recommendations: '',
      model: '',
      tokensUsed: 0,
    };

    const result = await this.graph.invoke(initialState);

    return {
      result: result.recommendations,
      model: result.model,
      tokensUsed: result.tokensUsed,
    };
  }

  private async statisticalAnalysis(state: FlakyDetectGraphState): Promise<Partial<FlakyDetectGraphState>> {
    this.logger.debug('Performing statistical analysis on test history...');

    const { context } = state.input;
    const lang = this.getLanguageName(context.locale);
    const testHistory = Array.isArray(context.testHistory) ? context.testHistory : [];

    // Build statistical data from test history
    const testStats: Record<string, { passed: number; failed: number; totalRuns: number; durations: number[] }> = {};

    for (const run of testHistory) {
      for (const result of run.results) {
        if (!testStats[result.testName]) {
          testStats[result.testName] = { passed: 0, failed: 0, totalRuns: 0, durations: [] };
        }
        const stat = testStats[result.testName];
        stat.totalRuns++;
        if (result.status === 'passed') stat.passed++;
        if (result.status === 'failed') stat.failed++;
        stat.durations.push(result.duration);
      }
    }

    // Calculate flakiness scores
    const flakinessData = Object.entries(testStats).map(([testName, stat]) => {
      const failRate = stat.failed / stat.totalRuns;
      const passRate = stat.passed / stat.totalRuns;
      // A truly flaky test fails sometimes but not always
      const flakinessScore = Math.min(failRate, passRate) * 2;
      const avgDuration = stat.durations.reduce((a, b) => a + b, 0) / stat.durations.length;
      const durationVariance = stat.durations.reduce((sum, d) => sum + Math.pow(d - avgDuration, 2), 0) / stat.durations.length;

      return {
        testName,
        flakinessScore: Math.round(flakinessScore * 100) / 100,
        failRate: Math.round(failRate * 100) / 100,
        totalRuns: stat.totalRuns,
        avgDuration: Math.round(avgDuration),
        durationVariance: Math.round(durationVariance),
      };
    });

    const flakyTests = flakinessData.filter((t) => t.flakinessScore > 0.1);

    const response = await this.fastModel.invoke([
      new SystemMessage(
        `You are a test reliability engineer. Analyze the following statistical data about test flakiness. ` +
        `Summarize the findings: which tests are most flaky, what the overall flakiness rate is, ` +
        `and any initial observations about duration variance that might indicate timing issues. ` +
        `Write your analysis in ${lang}.`,
      ),
      new HumanMessage(
        `Flaky Tests (score > 0.1):\n${JSON.stringify(flakyTests, null, 2)}\n\n` +
        `All Test Stats:\n${JSON.stringify(flakinessData, null, 2)}`,
      ),
    ]);

    const tokensUsed = response.usage_metadata?.total_tokens ?? 0;

    return {
      statisticalAnalysis: typeof response.content === 'string' ? response.content : JSON.stringify(response.content),
      model: this.fastModel.modelName || 'gpt-4.1-mini',
      tokensUsed,
    };
  }

  private async patternDetection(state: FlakyDetectGraphState): Promise<Partial<FlakyDetectGraphState>> {
    this.logger.debug('Detecting flakiness patterns...');

    const { context } = state.input;
    const lang = this.getLanguageName(context.locale);
    const testHistory = Array.isArray(context.testHistory) ? context.testHistory : [];
    const testResults = Array.isArray(context.testResults) ? context.testResults : [];
    const response = await this.model.invoke([
      new SystemMessage(
        `You are an expert at identifying flaky test patterns. Based on the statistical analysis ` +
        `and test history, detect patterns that cause flakiness:\n` +
        `- Timing-dependent: Tests that rely on specific timing or timeouts\n` +
        `- Order-dependent: Tests that pass/fail based on execution order\n` +
        `- Environment-dependent: Tests affected by system state, file system, network\n` +
        `- Race conditions: Tests with concurrent access issues\n\n` +
        `For each flaky test, identify the most likely pattern and explain why. ` +
        `Write your analysis in ${lang}.`,
      ),
      new HumanMessage(
        `Statistical Analysis:\n${state.statisticalAnalysis}\n\n` +
        `Test History (last ${testHistory.length} runs):\n` +
        JSON.stringify(testHistory.slice(0, 5), null, 2) +
        `\n\nCurrent Test Results:\n${JSON.stringify(testResults, null, 2)}`,
      ),
    ]);

    const tokensUsed = response.usage_metadata?.total_tokens ?? 0;

    return {
      patternAnalysis: typeof response.content === 'string' ? response.content : JSON.stringify(response.content),
      tokensUsed,
    };
  }

  private async generateRecommendations(state: FlakyDetectGraphState): Promise<Partial<FlakyDetectGraphState>> {
    this.logger.debug('Generating flaky test recommendations...');

    const lang = this.getLanguageName(state.input.context.locale);
    const response = await this.model.invoke([
      new SystemMessage(
        `You are a test reliability engineer writing a report for a general audience (not just developers). ` +
        `Based on the analysis, generate a JSON report:\n` +
        `{\n` +
        `  "flakyTests": [{\n` +
        `    "testName": "name of the test or test step",\n` +
        `    "flakinessScore": 0.0-1.0,\n` +
        `    "failRate": 0.0-1.0,\n` +
        `    "pattern": "timing-dependent|order-dependent|environment-dependent|race-condition|unknown",\n` +
        `    "patternLabel": "human-readable pattern name",\n` +
        `    "description": "clear explanation of why this test is flaky, understandable by non-developers",\n` +
        `    "impact": "what happens when this test is flaky — e.g. false CI failures, wasted developer time",\n` +
        `    "recommendation": "specific actionable steps to fix"\n` +
        `  }],\n` +
        `  "summary": "brief overview of findings for a project manager",\n` +
        `  "totalAnalyzed": number,\n` +
        `  "flakyCount": number,\n` +
        `  "stableCount": number,\n` +
        `  "overallHealthScore": 0-100\n` +
        `}\n` +
        `IMPORTANT: Write ALL text fields (patternLabel, description, impact, recommendation, summary) in ${lang}. ` +
        `Keep only testName, pattern (enum value), and JSON keys in English.\n` +
        `Order flaky tests by flakinessScore descending (most flaky first).`,
      ),
      new HumanMessage(
        `Statistical Analysis:\n${state.statisticalAnalysis}\n\n` +
        `Pattern Analysis:\n${state.patternAnalysis}`,
      ),
    ]);

    const tokensUsed = response.usage_metadata?.total_tokens ?? 0;

    return {
      recommendations: typeof response.content === 'string' ? response.content : JSON.stringify(response.content),
      tokensUsed,
    };
  }
}
