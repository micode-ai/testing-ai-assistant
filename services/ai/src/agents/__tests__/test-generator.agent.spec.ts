import { ConfigService } from '@nestjs/config';
import { TestGeneratorAgent } from '../test-generator/test-generator.agent';
import { TestGenInput } from '../types';

// Mock LangChain modules
jest.mock('@langchain/openai', () => {
  return {
    ChatOpenAI: jest.fn().mockImplementation(() => ({
      modelName: 'o3',
      invoke: jest.fn(),
    })),
  };
});

jest.mock('@langchain/langgraph', () => {
  const mockCompiled = {
    invoke: jest.fn(),
  };

  const mockWorkflow = {
    addNode: jest.fn().mockReturnThis(),
    addEdge: jest.fn().mockReturnThis(),
    addConditionalEdges: jest.fn().mockReturnThis(),
    compile: jest.fn().mockReturnValue(mockCompiled),
  };

  return {
    StateGraph: jest.fn().mockImplementation(() => mockWorkflow),
    END: '__end__',
    START: '__start__',
    Annotation: {
      Root: jest.fn().mockImplementation((schema) => {
        const State = {};
        return { State };
      }),
    },
  };
});

jest.mock('@langchain/core/messages', () => ({
  HumanMessage: jest.fn().mockImplementation((content) => ({ content, role: 'human' })),
  SystemMessage: jest.fn().mockImplementation((content) => ({ content, role: 'system' })),
}));

describe('TestGeneratorAgent', () => {
  let agent: TestGeneratorAgent;
  let configService: jest.Mocked<ConfigService>;

  const mockInput: TestGenInput = {
    projectId: 'project-1',
    context: {
      codeDiff: `
diff --git a/src/utils.ts b/src/utils.ts
--- a/src/utils.ts
+++ b/src/utils.ts
@@ -1,5 +1,15 @@
+export function calculateDiscount(price: number, percentage: number): number {
+  if (percentage < 0 || percentage > 100) {
+    throw new Error('Percentage must be between 0 and 100');
+  }
+  return price * (1 - percentage / 100);
+}
      `,
      fileContents: {
        'src/utils.ts': `
export function calculateDiscount(price: number, percentage: number): number {
  if (percentage < 0 || percentage > 100) {
    throw new Error('Percentage must be between 0 and 100');
  }
  return price * (1 - percentage / 100);
}`,
      },
      existingTests: ['src/utils.spec.ts'],
      testFramework: 'jest',
      language: 'typescript',
    },
  };

  beforeEach(() => {
    configService = {
      get: jest.fn().mockImplementation((key: string, defaultValue?: string) => {
        const config: Record<string, string> = {
          OPENAI_MODEL_ADVANCED: 'o3',
          OPENAI_MODEL_FAST: 'gpt-4.1-mini',
          OPENAI_API_KEY: 'test-key',
        };
        return config[key] || defaultValue;
      }),
    } as any;

    agent = new TestGeneratorAgent(configService);
  });

  it('should be instantiated correctly', () => {
    expect(agent).toBeDefined();
  });

  it('should call the compiled graph on run', async () => {
    // Access the compiled graph mock
    const { StateGraph } = require('@langchain/langgraph');
    const mockWorkflowInstance = new StateGraph();
    const mockCompiled = mockWorkflowInstance.compile();

    mockCompiled.invoke.mockResolvedValue({
      input: mockInput,
      analysis: 'Test analysis: calculateDiscount needs unit tests for edge cases',
      generatedTests: `
import { calculateDiscount } from './utils';

describe('calculateDiscount', () => {
  it('should calculate discount correctly', () => {
    expect(calculateDiscount(100, 10)).toBe(90);
  });

  it('should return original price for 0% discount', () => {
    expect(calculateDiscount(100, 0)).toBe(100);
  });

  it('should return 0 for 100% discount', () => {
    expect(calculateDiscount(100, 100)).toBe(0);
  });

  it('should throw for negative percentage', () => {
    expect(() => calculateDiscount(100, -1)).toThrow('Percentage must be between 0 and 100');
  });

  it('should throw for percentage over 100', () => {
    expect(() => calculateDiscount(100, 101)).toThrow('Percentage must be between 0 and 100');
  });
});`,
      validationResult: { valid: true, issues: [] },
      refinementCount: 0,
      finalOutput: `
import { calculateDiscount } from './utils';

describe('calculateDiscount', () => {
  it('should calculate discount correctly', () => {
    expect(calculateDiscount(100, 10)).toBe(90);
  });

  it('should return original price for 0% discount', () => {
    expect(calculateDiscount(100, 0)).toBe(100);
  });

  it('should return 0 for 100% discount', () => {
    expect(calculateDiscount(100, 100)).toBe(0);
  });

  it('should throw for negative percentage', () => {
    expect(() => calculateDiscount(100, -1)).toThrow('Percentage must be between 0 and 100');
  });

  it('should throw for percentage over 100', () => {
    expect(() => calculateDiscount(100, 101)).toThrow('Percentage must be between 0 and 100');
  });
});`,
      model: 'o3',
      tokensUsed: 2500,
    });

    const result = await agent.run(mockInput);

    expect(result).toBeDefined();
    expect(result.result).toContain('calculateDiscount');
    expect(result.model).toBe('o3');
    expect(result.tokensUsed).toBe(2500);
  });

  it('should handle graph invocation errors', async () => {
    const { StateGraph } = require('@langchain/langgraph');
    const mockWorkflowInstance = new StateGraph();
    const mockCompiled = mockWorkflowInstance.compile();

    mockCompiled.invoke.mockRejectedValue(new Error('OpenAI API rate limit exceeded'));

    await expect(agent.run(mockInput)).rejects.toThrow('OpenAI API rate limit exceeded');
  });

  it('should pass correct initial state to graph', async () => {
    const { StateGraph } = require('@langchain/langgraph');
    const mockWorkflowInstance = new StateGraph();
    const mockCompiled = mockWorkflowInstance.compile();

    mockCompiled.invoke.mockResolvedValue({
      finalOutput: 'test output',
      model: 'o3',
      tokensUsed: 100,
    });

    await agent.run(mockInput);

    expect(mockCompiled.invoke).toHaveBeenCalledWith(
      expect.objectContaining({
        input: mockInput,
        analysis: '',
        generatedTests: '',
        validationResult: { valid: false, issues: [] },
        refinementCount: 0,
        finalOutput: '',
        model: '',
        tokensUsed: 0,
      }),
    );
  });

  describe('graph structure', () => {
    it('should define all required nodes', () => {
      const { StateGraph } = require('@langchain/langgraph');
      const mockInstance = StateGraph.mock.results[StateGraph.mock.results.length - 1]?.value;

      if (mockInstance) {
        // Verify that addNode was called with expected node names
        const addNodeCalls = mockInstance.addNode.mock.calls.map(
          (call: any[]) => call[0],
        );
        expect(addNodeCalls).toContain('analyzeCode');
        expect(addNodeCalls).toContain('generateTests');
        expect(addNodeCalls).toContain('validateTests');
        expect(addNodeCalls).toContain('refineTests');
        expect(addNodeCalls).toContain('formatOutput');
      }
    });

    it('should define edges including conditional edge for refinement', () => {
      const { StateGraph } = require('@langchain/langgraph');
      const mockInstance = StateGraph.mock.results[StateGraph.mock.results.length - 1]?.value;

      if (mockInstance) {
        // Verify conditional edges were added (for the refine/done decision)
        expect(mockInstance.addConditionalEdges).toHaveBeenCalled();

        const conditionalCall = mockInstance.addConditionalEdges.mock.calls[0];
        expect(conditionalCall[0]).toBe('validateTests');
        // The routing map should include 'refine' and 'done'
        expect(conditionalCall[2]).toEqual({
          refine: 'refineTests',
          done: 'formatOutput',
        });
      }
    });
  });
});
