import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StateGraph, END, START, Annotation } from '@langchain/langgraph';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { BaseAgent } from '../base-agent';
import { AgentOutput, TestGenInput, TestGenState } from '../types';

const TestGenAnnotation = Annotation.Root({
  input: Annotation<TestGenInput>,
  analysis: Annotation<string>({ reducer: (_, b) => b, default: () => '' }),
  generatedTests: Annotation<string>({ reducer: (_, b) => b, default: () => '' }),
  validationResult: Annotation<{ valid: boolean; issues: string[] }>({
    reducer: (_, b) => b,
    default: () => ({ valid: false, issues: [] }),
  }),
  refinementCount: Annotation<number>({ reducer: (_, b) => b, default: () => 0 }),
  finalOutput: Annotation<string>({ reducer: (_, b) => b, default: () => '' }),
  model: Annotation<string>({ reducer: (_, b) => b, default: () => '' }),
  tokensUsed: Annotation<number>({ reducer: (a, b) => a + b, default: () => 0 }),
});

type TestGenGraphState = typeof TestGenAnnotation.State;

export class TestGeneratorAgent extends BaseAgent {
  private readonly logger = new Logger(TestGeneratorAgent.name);
  private graph: ReturnType<StateGraph<typeof TestGenAnnotation>['compile']>;

  constructor(configService: ConfigService) {
    super(configService);
    this.graph = this.buildGraph();
  }

  private buildGraph() {
    const workflow = new StateGraph(TestGenAnnotation)
      .addNode('analyzeCode', this.analyzeCode.bind(this))
      .addNode('generateTests', this.generateTests.bind(this))
      .addNode('validateTests', this.validateTests.bind(this))
      .addNode('refineTests', this.refineTests.bind(this))
      .addNode('formatOutput', this.formatOutput.bind(this))
      .addEdge(START, 'analyzeCode')
      .addEdge('analyzeCode', 'generateTests')
      .addEdge('generateTests', 'validateTests')
      .addConditionalEdges('validateTests', this.shouldRefine.bind(this), {
        refine: 'refineTests',
        done: 'formatOutput',
      })
      .addEdge('refineTests', 'validateTests')
      .addEdge('formatOutput', END);

    return workflow.compile() as any;
  }

  async run(input: TestGenInput): Promise<AgentOutput> {
    this.logger.log(`Running test generator for project ${input.projectId}`);

    const initialState: Partial<TestGenGraphState> = {
      input,
      analysis: '',
      generatedTests: '',
      validationResult: { valid: false, issues: [] },
      refinementCount: 0,
      finalOutput: '',
      model: '',
      tokensUsed: 0,
    };

    const result = await this.graph.invoke(initialState);

    return {
      result: result.finalOutput,
      model: result.model,
      tokensUsed: result.tokensUsed,
    };
  }

  private async analyzeCode(state: TestGenGraphState): Promise<Partial<TestGenGraphState>> {
    this.logger.debug('Analyzing code changes...');

    const { context } = state.input;
    const response = await this.model.invoke([
      new SystemMessage(
        'You are an expert test engineer. Analyze the following code changes and determine what tests are needed. ' +
        'Consider edge cases, error handling, boundary conditions, and integration points. ' +
        'Output a structured analysis of what tests should be written.',
      ),
      new HumanMessage(
        `Code Diff:\n${context.codeDiff}\n\n` +
        `File Contents:\n${JSON.stringify(context.fileContents, null, 2)}\n\n` +
        `Existing Tests:\n${context.existingTests.join('\n')}\n\n` +
        `Test Framework: ${context.testFramework}\n` +
        `Language: ${context.language}`,
      ),
    ]);

    const tokensUsed = response.usage_metadata?.total_tokens ?? 0;

    return {
      analysis: typeof response.content === 'string' ? response.content : JSON.stringify(response.content),
      model: this.model.modelName || 'o3',
      tokensUsed,
    };
  }

  private async generateTests(state: TestGenGraphState): Promise<Partial<TestGenGraphState>> {
    this.logger.debug('Generating test code...');

    const { context } = state.input;
    const response = await this.model.invoke([
      new SystemMessage(
        'You are an expert test engineer. Based on the analysis provided, generate complete, runnable test code. ' +
        `Use the ${context.testFramework} framework. Write tests in ${context.language}. ` +
        'Include proper imports, setup/teardown, meaningful test names, and comprehensive assertions. ' +
        'Output ONLY the test code, no explanations.',
      ),
      new HumanMessage(
        `Analysis:\n${state.analysis}\n\n` +
        `Code Diff:\n${context.codeDiff}\n\n` +
        `File Contents:\n${JSON.stringify(context.fileContents, null, 2)}\n\n` +
        `Existing Tests:\n${context.existingTests.join('\n')}`,
      ),
    ]);

    const tokensUsed = response.usage_metadata?.total_tokens ?? 0;

    return {
      generatedTests: typeof response.content === 'string' ? response.content : JSON.stringify(response.content),
      tokensUsed,
    };
  }

  private async validateTests(state: TestGenGraphState): Promise<Partial<TestGenGraphState>> {
    this.logger.debug('Validating generated tests...');

    const response = await this.fastModel.invoke([
      new SystemMessage(
        'You are a test code reviewer. Review the following generated test code for: ' +
        '1. Syntax errors\n2. Logic issues\n3. Missing imports\n4. Incorrect assertions\n' +
        '5. Missing edge cases from the analysis\n\n' +
        'Respond with a JSON object: { "valid": boolean, "issues": string[] }. ' +
        'If the tests are valid and complete, set valid to true and issues to an empty array.',
      ),
      new HumanMessage(
        `Analysis:\n${state.analysis}\n\n` +
        `Generated Tests:\n${state.generatedTests}`,
      ),
    ]);

    const tokensUsed = response.usage_metadata?.total_tokens ?? 0;
    const content = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);

    let validationResult: { valid: boolean; issues: string[] };
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      validationResult = jsonMatch ? JSON.parse(jsonMatch[0]) : { valid: true, issues: [] };
    } catch {
      validationResult = { valid: true, issues: [] };
    }

    return {
      validationResult,
      tokensUsed,
    };
  }

  private shouldRefine(state: TestGenGraphState): 'refine' | 'done' {
    if (!state.validationResult.valid && state.refinementCount < 3) {
      return 'refine';
    }
    return 'done';
  }

  private async refineTests(state: TestGenGraphState): Promise<Partial<TestGenGraphState>> {
    this.logger.debug(`Refining tests (attempt ${state.refinementCount + 1}/3)...`);

    const response = await this.model.invoke([
      new SystemMessage(
        'You are an expert test engineer. The following test code has issues that need to be fixed. ' +
        'Fix all the identified issues while maintaining the test structure and coverage. ' +
        'Output ONLY the corrected test code.',
      ),
      new HumanMessage(
        `Original Tests:\n${state.generatedTests}\n\n` +
        `Issues Found:\n${state.validationResult.issues.join('\n')}`,
      ),
    ]);

    const tokensUsed = response.usage_metadata?.total_tokens ?? 0;

    return {
      generatedTests: typeof response.content === 'string' ? response.content : JSON.stringify(response.content),
      refinementCount: state.refinementCount + 1,
      tokensUsed,
    };
  }

  private async formatOutput(state: TestGenGraphState): Promise<Partial<TestGenGraphState>> {
    return {
      finalOutput: state.generatedTests,
    };
  }
}
