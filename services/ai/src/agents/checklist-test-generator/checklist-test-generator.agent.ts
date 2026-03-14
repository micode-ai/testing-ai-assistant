import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StateGraph, END, START, Annotation } from '@langchain/langgraph';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { BaseAgent } from '../base-agent';
import { AgentOutput, ChecklistTestGenInput } from '../types';

const ChecklistTestGenAnnotation = Annotation.Root({
  input: Annotation<ChecklistTestGenInput>,
  analysis: Annotation<string>({ reducer: (_, b) => b, default: () => '' }),
  generatedTest: Annotation<string>({ reducer: (_, b) => b, default: () => '' }),
  validationResult: Annotation<{ valid: boolean; issues: string[] }>({
    reducer: (_, b) => b,
    default: () => ({ valid: false, issues: [] }),
  }),
  refinementCount: Annotation<number>({ reducer: (_, b) => b, default: () => 0 }),
  finalOutput: Annotation<string>({ reducer: (_, b) => b, default: () => '' }),
  model: Annotation<string>({ reducer: (_, b) => b, default: () => '' }),
  tokensUsed: Annotation<number>({ reducer: (a, b) => a + b, default: () => 0 }),
});

type State = typeof ChecklistTestGenAnnotation.State;

export class ChecklistTestGeneratorAgent extends BaseAgent {
  private readonly logger = new Logger(ChecklistTestGeneratorAgent.name);
  private graph: ReturnType<StateGraph<typeof ChecklistTestGenAnnotation>['compile']>;

  constructor(configService: ConfigService) {
    super(configService);
    this.graph = this.buildGraph();
  }

  private buildGraph() {
    const workflow = new StateGraph(ChecklistTestGenAnnotation)
      .addNode('analyzeItem', this.analyzeItem.bind(this))
      .addNode('generateTest', this.generateTest.bind(this))
      .addNode('validateTest', this.validateTest.bind(this))
      .addNode('refineTest', this.refineTest.bind(this))
      .addNode('formatOutput', this.formatOutput.bind(this))
      .addEdge(START, 'analyzeItem')
      .addEdge('analyzeItem', 'generateTest')
      .addEdge('generateTest', 'validateTest')
      .addConditionalEdges('validateTest', this.shouldRefine.bind(this), {
        refine: 'refineTest',
        done: 'formatOutput',
      })
      .addEdge('refineTest', 'validateTest')
      .addEdge('formatOutput', END);

    return workflow.compile() as any;
  }

  async run(input: ChecklistTestGenInput): Promise<AgentOutput> {
    this.logger.log(`Generating Playwright test for: ${input.context.checklistItem.title}`);

    const result = await this.graph.invoke({
      input,
      analysis: '',
      generatedTest: '',
      validationResult: { valid: false, issues: [] },
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

  private async analyzeItem(state: State): Promise<Partial<State>> {
    const { checklistItem, targetUrl } = state.input.context;

    const response = await this.model.invoke([
      new SystemMessage(
        'You are an expert Playwright E2E test engineer. Analyze the following test case and plan the test steps. ' +
        'Identify: page navigation, element selectors to use, user interactions, assertions to make, ' +
        'and potential wait conditions. Consider using accessible selectors (role, label, placeholder, text) ' +
        'instead of CSS selectors when possible.',
      ),
      new HumanMessage(
        `Test Case: ${checklistItem.title}\n` +
        `Description: ${checklistItem.description}\n` +
        `Expected Behavior: ${checklistItem.expectedBehavior}\n` +
        `Target URL: ${targetUrl}`,
      ),
    ]);

    return {
      analysis: typeof response.content === 'string' ? response.content : JSON.stringify(response.content),
      model: this.model.modelName || 'o3',
      tokensUsed: response.usage_metadata?.total_tokens ?? 0,
    };
  }

  private async generateTest(state: State): Promise<Partial<State>> {
    const { checklistItem, targetUrl } = state.input.context;

    const response = await this.model.invoke([
      new SystemMessage(
        'You are an expert Playwright test engineer. Generate a complete, runnable Playwright test file.\n\n' +
        'Rules:\n' +
        '- Use TypeScript with `import { test, expect } from "@playwright/test"`\n' +
        '- Do NOT hardcode the base URL — use relative paths (baseURL is set in config)\n' +
        '- Use accessible selectors: `page.getByRole()`, `page.getByLabel()`, `page.getByPlaceholder()`, `page.getByText()`\n' +
        '- Add proper `await` for all Playwright calls\n' +
        '- Include meaningful test description in `test()` name\n' +
        '- Add proper assertions with `expect()`\n' +
        '- Handle loading states with `waitForLoadState` or `waitForSelector` where needed\n' +
        '- Take a screenshot at key assertion points using `page.screenshot()`\n' +
        '- Keep it focused — test exactly what the checklist item describes\n\n' +
        'Output ONLY the TypeScript test code, no markdown fences or explanations.',
      ),
      new HumanMessage(
        `Test Case: ${checklistItem.title}\n` +
        `Description: ${checklistItem.description}\n` +
        `Expected Behavior: ${checklistItem.expectedBehavior}\n` +
        `Target URL: ${targetUrl}\n\n` +
        `Test Plan:\n${state.analysis}`,
      ),
    ]);

    return {
      generatedTest: typeof response.content === 'string' ? response.content : JSON.stringify(response.content),
      tokensUsed: response.usage_metadata?.total_tokens ?? 0,
    };
  }

  private async validateTest(state: State): Promise<Partial<State>> {
    const response = await this.fastModel.invoke([
      new SystemMessage(
        'You are a Playwright test reviewer. Check the following test code for:\n' +
        '1. Valid TypeScript syntax\n' +
        '2. Correct Playwright API usage (await on all async calls)\n' +
        '3. Proper imports (`import { test, expect } from "@playwright/test"`)\n' +
        '4. No hardcoded absolute URLs (should use relative paths)\n' +
        '5. Meaningful assertions with `expect()`\n' +
        '6. No markdown code fences (```) in the output\n\n' +
        'Respond with JSON: { "valid": boolean, "issues": string[] }',
      ),
      new HumanMessage(state.generatedTest),
    ]);

    const content = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
    let validationResult: { valid: boolean; issues: string[] };
    try {
      const match = content.match(/\{[\s\S]*\}/);
      validationResult = match ? JSON.parse(match[0]) : { valid: true, issues: [] };
    } catch {
      validationResult = { valid: true, issues: [] };
    }

    return {
      validationResult,
      tokensUsed: response.usage_metadata?.total_tokens ?? 0,
    };
  }

  private shouldRefine(state: State): 'refine' | 'done' {
    if (!state.validationResult.valid && state.refinementCount < 3) return 'refine';
    return 'done';
  }

  private async refineTest(state: State): Promise<Partial<State>> {
    this.logger.debug(`Refining test (attempt ${state.refinementCount + 1}/3)...`);

    const response = await this.model.invoke([
      new SystemMessage(
        'Fix the issues in this Playwright test. Output ONLY the corrected TypeScript test code, no markdown.',
      ),
      new HumanMessage(
        `Test Code:\n${state.generatedTest}\n\nIssues:\n${state.validationResult.issues.join('\n')}`,
      ),
    ]);

    return {
      generatedTest: typeof response.content === 'string' ? response.content : JSON.stringify(response.content),
      refinementCount: state.refinementCount + 1,
      tokensUsed: response.usage_metadata?.total_tokens ?? 0,
    };
  }

  private async formatOutput(state: State): Promise<Partial<State>> {
    // Strip markdown fences if present
    let code = state.generatedTest;
    code = code.replace(/^```(?:typescript|ts|javascript|js)?\n?/m, '');
    code = code.replace(/\n?```\s*$/m, '');
    return { finalOutput: code.trim() };
  }
}
