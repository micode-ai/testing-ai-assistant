import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { Logger } from '@nestjs/common';

const logger = new Logger('PlatformTools');

/**
 * Create an HTTP client for inter-service calls, forwarding the user's JWT.
 */
function serviceClient(baseUrl: string, token: string) {
  return async <T>(path: string, options: RequestInit = {}): Promise<T> => {
    const response = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(options.headers as Record<string, string>),
      },
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`HTTP ${response.status}: ${body}`);
    }

    if (response.status === 204) return undefined as T;
    return response.json() as T;
  };
}

export interface ToolContext {
  token: string;
  projectId: string;
  projectServiceUrl: string;
  pipelineServiceUrl: string;
  aiServiceUrl: string;
}

export function createPlatformTools(ctx: ToolContext): DynamicStructuredTool[] {
  const projectApi = serviceClient(ctx.projectServiceUrl, ctx.token);
  const pipelineApi = serviceClient(ctx.pipelineServiceUrl, ctx.token);
  const aiApi = serviceClient(ctx.aiServiceUrl, ctx.token);

  return [
    new DynamicStructuredTool({
      name: 'list_projects',
      description: 'List all projects accessible to the current user',
      schema: z.object({}),
      func: async () => {
        try {
          const projects = await projectApi<unknown[]>('/projects');
          return JSON.stringify(projects, null, 2);
        } catch (err) {
          logger.error(`list_projects failed: ${err}`);
          return `Error: ${err}`;
        }
      },
    }),

    new DynamicStructuredTool({
      name: 'list_pipelines',
      description: 'List pipelines for a given project',
      schema: z.object({
        projectId: z.string().describe('The project ID to list pipelines for'),
      }),
      func: async ({ projectId }) => {
        try {
          const pipelines = await pipelineApi<unknown[]>(`/pipelines?projectId=${projectId}`);
          return JSON.stringify(pipelines, null, 2);
        } catch (err) {
          logger.error(`list_pipelines failed: ${err}`);
          return `Error: ${err}`;
        }
      },
    }),

    new DynamicStructuredTool({
      name: 'trigger_pipeline',
      description: 'Trigger a test run for a pipeline. Returns the created test run.',
      schema: z.object({
        pipelineId: z.string().describe('The pipeline ID to trigger'),
      }),
      func: async ({ pipelineId }) => {
        try {
          const run = await pipelineApi<unknown>('/test-runs', {
            method: 'POST',
            body: JSON.stringify({ pipelineId }),
          });
          return JSON.stringify(run, null, 2);
        } catch (err) {
          logger.error(`trigger_pipeline failed: ${err}`);
          return `Error: ${err}`;
        }
      },
    }),

    new DynamicStructuredTool({
      name: 'get_run_status',
      description: 'Get the current status and details of a test run',
      schema: z.object({
        runId: z.string().describe('The test run ID'),
      }),
      func: async ({ runId }) => {
        try {
          const run = await pipelineApi<unknown>(`/test-runs/${runId}`);
          return JSON.stringify(run, null, 2);
        } catch (err) {
          logger.error(`get_run_status failed: ${err}`);
          return `Error: ${err}`;
        }
      },
    }),

    new DynamicStructuredTool({
      name: 'list_checklists',
      description: 'List checklists for a project',
      schema: z.object({
        projectId: z.string().describe('The project ID'),
      }),
      func: async ({ projectId }) => {
        try {
          const checklists = await pipelineApi<unknown[]>(`/checklists?projectId=${projectId}`);
          return JSON.stringify(checklists, null, 2);
        } catch (err) {
          logger.error(`list_checklists failed: ${err}`);
          return `Error: ${err}`;
        }
      },
    }),

    new DynamicStructuredTool({
      name: 'create_checklist',
      description: 'Create a new checklist for a project with test items',
      schema: z.object({
        projectId: z.string().describe('The project ID'),
        name: z.string().describe('Name of the checklist'),
        description: z.string().optional().describe('Description of the checklist'),
        targetUrl: z.string().optional().describe('Target URL to test against'),
        items: z
          .array(
            z.object({
              title: z.string().describe('Item title'),
              description: z.string().optional().describe('Item description'),
              expectedBehavior: z.string().optional().describe('Expected behavior'),
              priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
            }),
          )
          .optional()
          .describe('Checklist items'),
      }),
      func: async ({ projectId, name, description, targetUrl, items }) => {
        try {
          const checklist = await pipelineApi<unknown>('/checklists', {
            method: 'POST',
            body: JSON.stringify({ projectId, name, description, targetUrl, items }),
          });
          return JSON.stringify(checklist, null, 2);
        } catch (err) {
          logger.error(`create_checklist failed: ${err}`);
          return `Error: ${err}`;
        }
      },
    }),

    new DynamicStructuredTool({
      name: 'run_checklist',
      description: 'Execute a checklist against a target URL',
      schema: z.object({
        checklistId: z.string().describe('The checklist ID to run'),
        targetUrl: z.string().describe('The URL to test against'),
      }),
      func: async ({ checklistId, targetUrl }) => {
        try {
          const run = await pipelineApi<unknown>(`/checklists/${checklistId}/run`, {
            method: 'POST',
            body: JSON.stringify({ targetUrl }),
          });
          return JSON.stringify(run, null, 2);
        } catch (err) {
          logger.error(`run_checklist failed: ${err}`);
          return `Error: ${err}`;
        }
      },
    }),

    new DynamicStructuredTool({
      name: 'get_checklist_run',
      description: 'Get checklist run results including individual item statuses',
      schema: z.object({
        runId: z.string().describe('The checklist run ID'),
      }),
      func: async ({ runId }) => {
        try {
          const run = await pipelineApi<unknown>(`/checklist-runs/${runId}`);
          return JSON.stringify(run, null, 2);
        } catch (err) {
          logger.error(`get_checklist_run failed: ${err}`);
          return `Error: ${err}`;
        }
      },
    }),

    new DynamicStructuredTool({
      name: 'generate_tests',
      description: 'Generate AI tests for code. Requires a project ID and generation type.',
      schema: z.object({
        projectId: z.string().describe('The project ID'),
        type: z.enum(['TEST_GEN', 'BUG_DETECT', 'FLAKY_DETECT', 'COVERAGE_ADVICE', 'CHECKLIST_GEN', 'CHECKLIST_TEST_GEN']),
        inputContext: z.record(z.unknown()).describe('Context for the generation'),
      }),
      func: async ({ projectId, type, inputContext }) => {
        try {
          const result = await aiApi<unknown>('/ai/generate', {
            method: 'POST',
            body: JSON.stringify({ projectId, type, inputContext }),
          });
          return JSON.stringify(result, null, 2);
        } catch (err) {
          logger.error(`generate_tests failed: ${err}`);
          return `Error: ${err}`;
        }
      },
    }),
  ];
}
