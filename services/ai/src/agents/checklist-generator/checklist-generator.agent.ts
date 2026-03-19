import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StateGraph, END, START, Annotation } from '@langchain/langgraph';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { BaseAgent } from '../base-agent';
import { AgentOutput, ChecklistGenInput } from '../types';

const ChecklistGenAnnotation = Annotation.Root({
  input: Annotation<ChecklistGenInput>,
  analysis: Annotation<string>({ reducer: (_, b) => b, default: () => '' }),
  checklist: Annotation<string>({ reducer: (_, b) => b, default: () => '' }),
  validation: Annotation<{ valid: boolean; issues: string[] }>({
    reducer: (_, b) => b,
    default: () => ({ valid: false, issues: [] }),
  }),
  refinementCount: Annotation<number>({ reducer: (_, b) => b, default: () => 0 }),
  finalOutput: Annotation<string>({ reducer: (_, b) => b, default: () => '' }),
  model: Annotation<string>({ reducer: (_, b) => b, default: () => '' }),
  tokensUsed: Annotation<number>({ reducer: (a, b) => a + b, default: () => 0 }),
});

type ChecklistGenGraphState = typeof ChecklistGenAnnotation.State;

export class ChecklistGeneratorAgent extends BaseAgent {
  private readonly logger = new Logger(ChecklistGeneratorAgent.name);
  private graph: ReturnType<StateGraph<typeof ChecklistGenAnnotation>['compile']>;

  constructor(configService: ConfigService) {
    super(configService);
    this.graph = this.buildGraph();
  }

  private buildGraph() {
    const workflow = new StateGraph(ChecklistGenAnnotation)
      .addNode('analyzeApp', this.analyzeApp.bind(this))
      .addNode('generateChecklist', this.generateChecklist.bind(this))
      .addNode('validateChecklist', this.validateChecklist.bind(this))
      .addNode('refineChecklist', this.refineChecklist.bind(this))
      .addNode('formatOutput', this.formatOutput.bind(this))
      .addEdge(START, 'analyzeApp')
      .addEdge('analyzeApp', 'generateChecklist')
      .addEdge('generateChecklist', 'validateChecklist')
      .addConditionalEdges('validateChecklist', this.shouldRefine.bind(this), {
        refine: 'refineChecklist',
        done: 'formatOutput',
      })
      .addEdge('refineChecklist', 'validateChecklist')
      .addEdge('formatOutput', END);

    return workflow.compile() as any;
  }

  async run(input: ChecklistGenInput): Promise<AgentOutput> {
    this.logger.log(`Generating checklist for project ${input.projectId}`);

    const result = await this.graph.invoke({
      input,
      analysis: '',
      checklist: '',
      validation: { valid: false, issues: [] },
      refinementCount: 0,
      finalOutput: '',
      model: '',
      tokensUsed: 0,
    });

    return {
      result: result.finalOutput,
      model: result.model,
      tokensUsed: result.tokensUsed,
    };
  }

  private async analyzeApp(state: ChecklistGenGraphState): Promise<Partial<ChecklistGenGraphState>> {
    this.logger.debug('Analyzing application...');

    const { context } = state.input;
    const parts: string[] = [];
    if (context.targetUrl) parts.push(`Target URL: ${context.targetUrl}`);
    if (context.repoUrl) parts.push(`Repository: ${context.repoUrl}`);
    if (context.appDescription) parts.push(`Description: ${context.appDescription}`);
    if (context.existingFeatures?.length) parts.push(`Known features:\n${context.existingFeatures.join('\n')}`);

    const response = await this.model.invoke([
      new SystemMessage(
        'You are a senior QA engineer. Analyze the application described below and identify all major ' +
        'user-facing features, workflows, and edge cases that need testing. ' +
        'Consider: authentication, navigation, forms, data display, error handling, responsive behavior, ' +
        'accessibility, and critical business flows. Output a structured analysis.',
      ),
      new HumanMessage(parts.join('\n\n') || 'No specific app information provided. Generate a generic web application test checklist.'),
    ]);

    return {
      analysis: typeof response.content === 'string' ? response.content : JSON.stringify(response.content),
      model: this.model.modelName || 'o3',
      tokensUsed: response.usage_metadata?.total_tokens ?? 0,
    };
  }

  private async generateChecklist(state: ChecklistGenGraphState): Promise<Partial<ChecklistGenGraphState>> {
    this.logger.debug('Generating checklist items...');

    const response = await this.model.invoke([
      new SystemMessage(
        'You are a senior QA engineer. Based on the analysis, generate a comprehensive test checklist.\n\n' +
        'Output a JSON array of checklist items. Each item must have:\n' +
        '- "section": logical grouping name (e.g. "Authentication", "Navigation", "Forms & Inputs", "Data Display", "Error Handling", "Responsive & Accessibility")\n' +
        '- "title": short, specific test case name\n' +
        '- "description": what to test and how\n' +
        '- "expectedBehavior": the expected outcome\n' +
        '- "priority": one of "CRITICAL", "HIGH", "MEDIUM", "LOW"\n\n' +
        'Group related items under the same section. Use 3-7 sections.\n' +
        'Cover happy paths, error handling, edge cases, and UI validation.\n' +
        'Generate 15-30 items. Output ONLY the JSON array, no markdown or explanations.',
      ),
      new HumanMessage(`Application Analysis:\n${state.analysis}`),
    ]);

    return {
      checklist: typeof response.content === 'string' ? response.content : JSON.stringify(response.content),
      tokensUsed: response.usage_metadata?.total_tokens ?? 0,
    };
  }

  private async validateChecklist(state: ChecklistGenGraphState): Promise<Partial<ChecklistGenGraphState>> {
    this.logger.debug('Validating checklist...');

    const response = await this.fastModel.invoke([
      new SystemMessage(
        'You are a QA reviewer. Validate the following test checklist JSON:\n' +
        '1. Is it valid JSON array?\n' +
        '2. Does each item have section, title, description, expectedBehavior, priority?\n' +
        '3. Are priorities valid (CRITICAL/HIGH/MEDIUM/LOW)?\n' +
        '4. Are test cases specific and testable?\n' +
        '5. Any duplicates?\n\n' +
        'Respond with JSON: { "valid": boolean, "issues": string[] }',
      ),
      new HumanMessage(state.checklist),
    ]);

    const content = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
    let validation: { valid: boolean; issues: string[] };
    try {
      const match = content.match(/\{[\s\S]*\}/);
      validation = match ? JSON.parse(match[0]) : { valid: true, issues: [] };
    } catch {
      validation = { valid: true, issues: [] };
    }

    return {
      validation,
      tokensUsed: response.usage_metadata?.total_tokens ?? 0,
    };
  }

  private shouldRefine(state: ChecklistGenGraphState): 'refine' | 'done' {
    if (!state.validation.valid && state.refinementCount < 2) return 'refine';
    return 'done';
  }

  private async refineChecklist(state: ChecklistGenGraphState): Promise<Partial<ChecklistGenGraphState>> {
    this.logger.debug(`Refining checklist (attempt ${state.refinementCount + 1}/2)...`);

    const response = await this.model.invoke([
      new SystemMessage(
        'Fix the issues in this test checklist JSON array. Output ONLY the corrected JSON array.',
      ),
      new HumanMessage(
        `Checklist:\n${state.checklist}\n\nIssues:\n${state.validation.issues.join('\n')}`,
      ),
    ]);

    return {
      checklist: typeof response.content === 'string' ? response.content : JSON.stringify(response.content),
      refinementCount: state.refinementCount + 1,
      tokensUsed: response.usage_metadata?.total_tokens ?? 0,
    };
  }

  private async formatOutput(state: ChecklistGenGraphState): Promise<Partial<ChecklistGenGraphState>> {
    // Ensure we output clean JSON
    let output = state.checklist;
    try {
      const match = output.match(/\[[\s\S]*\]/);
      if (match) {
        JSON.parse(match[0]); // validate
        output = match[0];
      }
    } catch {
      // Keep as-is
    }
    return { finalOutput: output };
  }
}
