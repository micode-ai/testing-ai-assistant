import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StateGraph, END, START, Annotation } from '@langchain/langgraph';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { BaseAgent } from '../base-agent';
import { AgentOutput, CoverageAdviceInput, CoverageAdviceState } from '../types';

const CoverageAdviceAnnotation = Annotation.Root({
  input: Annotation<CoverageAdviceInput>,
  analysis: Annotation<string>({ reducer: (_, b) => b, default: () => '' }),
  recommendations: Annotation<string>({ reducer: (_, b) => b, default: () => '' }),
  model: Annotation<string>({ reducer: (_, b) => b, default: () => '' }),
  tokensUsed: Annotation<number>({ reducer: (a, b) => a + b, default: () => 0 }),
});

type CoverageAdviceGraphState = typeof CoverageAdviceAnnotation.State;

export class CoverageAdvisorAgent extends BaseAgent {
  private readonly logger = new Logger(CoverageAdvisorAgent.name);
  private graph: ReturnType<StateGraph<typeof CoverageAdviceAnnotation>['compile']>;

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
    const workflow = new StateGraph(CoverageAdviceAnnotation)
      .addNode('analyzeCoverage', this.analyzeCoverage.bind(this))
      .addNode('generateRecommendations', this.generateRecommendations.bind(this))
      .addEdge(START, 'analyzeCoverage')
      .addEdge('analyzeCoverage', 'generateRecommendations')
      .addEdge('generateRecommendations', END);

    return workflow.compile() as any;
  }

  async run(input: CoverageAdviceInput): Promise<AgentOutput> {
    this.logger.log(`Running coverage advisor for project ${input.projectId}`);

    const initialState: Partial<CoverageAdviceGraphState> = {
      input,
      analysis: '',
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

  private async analyzeCoverage(state: CoverageAdviceGraphState): Promise<Partial<CoverageAdviceGraphState>> {
    this.logger.debug('Analyzing coverage data...');

    const { context } = state.input;
    const lang = this.getLanguageName(context.locale);
    const coverageData = context.coverageData || { totalLines: 0, coveredLines: 0, percentage: 0, byFile: {} };
    const byFile = coverageData.byFile || {};
    const uncoveredFiles = Array.isArray(context.uncoveredFiles) ? context.uncoveredFiles : [];
    const codeContent = context.codeContent || {};

    // Sort files by coverage percentage (ascending) to prioritize least covered
    const filesByPriority = Object.entries(byFile)
      .map(([file, data]) => ({ file, ...data }))
      .sort((a, b) => a.percentage - b.percentage);

    const response = await this.fastModel.invoke([
      new SystemMessage(
        `You are a test coverage expert. Analyze the following coverage data and identify: ` +
        `1. Files with the lowest coverage that need immediate attention\n` +
        `2. Critical code paths that are uncovered\n` +
        `3. Files where the uncovered lines represent important logic vs boilerplate\n` +
        `Prioritize based on code importance, not just percentage. ` +
        `Write your analysis in ${lang}.`,
      ),
      new HumanMessage(
        `Overall Coverage: ${coverageData.percentage}% (${coverageData.coveredLines}/${coverageData.totalLines} lines)\n\n` +
        `Files by Coverage (ascending):\n${JSON.stringify(filesByPriority.slice(0, 20), null, 2)}\n\n` +
        `Uncovered Files Details:\n${JSON.stringify(uncoveredFiles.slice(0, 15), null, 2)}\n\n` +
        `Code Content (top uncovered files):\n${JSON.stringify(
          Object.fromEntries(
            uncoveredFiles.slice(0, 5).map((f) => [f.filePath, codeContent[f.filePath] || 'N/A']),
          ),
          null,
          2,
        )}`,
      ),
    ]);

    const tokensUsed = response.usage_metadata?.total_tokens ?? 0;

    return {
      analysis: typeof response.content === 'string' ? response.content : JSON.stringify(response.content),
      model: this.fastModel.modelName || 'gpt-4.1-mini',
      tokensUsed,
    };
  }

  private async generateRecommendations(state: CoverageAdviceGraphState): Promise<Partial<CoverageAdviceGraphState>> {
    this.logger.debug('Generating coverage recommendations...');

    const { context } = state.input;
    const lang = this.getLanguageName(context.locale);
    const uncoveredFiles = Array.isArray(context.uncoveredFiles) ? context.uncoveredFiles : [];
    const codeContent = context.codeContent || {};

    const response = await this.fastModel.invoke([
      new SystemMessage(
        `You are a test coverage expert writing a report for a general audience. ` +
        `Based on the analysis, generate a JSON report:\n` +
        `{\n` +
        `  "recommendations": [{\n` +
        `    "filePath": "path/to/file",\n` +
        `    "priority": "high|medium|low",\n` +
        `    "testType": "unit|integration|e2e",\n` +
        `    "title": "short human-readable title",\n` +
        `    "description": "what to test and why, understandable by non-developers",\n` +
        `    "sampleTestStub": "// sample test code stub"\n` +
        `  }],\n` +
        `  "summary": "brief overview of coverage state and priorities",\n` +
        `  "overallPercentage": number,\n` +
        `  "prioritizedFiles": ["file1.ts", "file2.ts"]\n` +
        `}\n` +
        `IMPORTANT: Write ALL text fields (title, description, summary) in ${lang}. ` +
        `Keep file paths, code snippets, and JSON keys in English.\n` +
        `Include actual sample test stubs that developers can use as starting points.`,
      ),
      new HumanMessage(
        `Coverage Analysis:\n${state.analysis}\n\n` +
        `Code Content:\n${JSON.stringify(
          Object.fromEntries(
            uncoveredFiles.slice(0, 5).map((f) => [f.filePath, codeContent[f.filePath] || 'N/A']),
          ),
          null,
          2,
        )}`,
      ),
    ]);

    const tokensUsed = response.usage_metadata?.total_tokens ?? 0;

    return {
      recommendations: typeof response.content === 'string' ? response.content : JSON.stringify(response.content),
      tokensUsed,
    };
  }
}
