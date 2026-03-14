import { auth } from '@/lib/auth/auth';
import { AuthExpiredError } from '@/lib/api/client';
import { TestRun } from '@/types';

const PIPELINE_API_URL = process.env.NEXT_PUBLIC_PIPELINE_API_URL || 'http://localhost:3004';

async function runClient<T>(path: string, options: RequestInit & { token?: string } = {}): Promise<T> {
  const { token, ...fetchOptions } = options;

  let authToken = token;
  if (!authToken) {
    try {
      const session = await auth();
      authToken = (session as unknown as Record<string, unknown>)?.accessToken as string;
    } catch {
      // Client-side, token should be passed explicitly
    }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const response = await fetch(`${PIPELINE_API_URL}${path}`, {
    ...fetchOptions,
    headers,
  });

  if (response.status === 401) {
    throw new AuthExpiredError();
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

export async function getTestRuns(pipelineId: string, token?: string): Promise<TestRun[]> {
  return runClient<TestRun[]>(`/test-runs?pipelineId=${pipelineId}`, { token });
}

export async function getTestRun(id: string, token?: string): Promise<TestRun> {
  const raw = await runClient<Record<string, unknown>>(`/test-runs/${id}`, { token });
  return mapApiResponseToTestRun(raw);
}

const CHECK_TYPE_LABELS: Record<string, string> = {
  REPOSITORY_SETUP: 'Repository Setup',
  UNIT: 'Unit Tests',
  LINT: 'Linting',
  SAST: 'SAST Security Scan',
  DAST: 'DAST Security Scan',
  DEPENDENCY_AUDIT: 'Dependency Audit',
  E2E: 'E2E Tests',
  LOAD: 'Load Tests',
  INTEGRATION: 'Integration Tests',
  AI_REVIEW: 'AI Code Review',
  COVERAGE: 'Code Coverage',
};

/** Map API response (which has `results`) to frontend TestRun (which expects `steps`) */
function mapApiResponseToTestRun(raw: Record<string, unknown>): TestRun {
  const results = (raw.results ?? []) as {
    id: string;
    checkType: string;
    status: string;
    summary: string;
    durationMs: number;
    artifactUrl: string | null;
    details: Record<string, unknown> | null;
    createdAt: string;
  }[];

  const steps = results.map((r) => ({
    id: r.id,
    runId: raw.id as string,
    pipelineStepId: '',
    name: CHECK_TYPE_LABELS[r.checkType] || r.checkType,
    checkType: r.checkType as TestRun['steps'][number]['checkType'],
    status: r.status as TestRun['steps'][number]['status'],
    startedAt: r.createdAt ?? null,
    finishedAt: null,
    duration: r.durationMs ?? null,
    details: {
      summary: r.summary,
      ...(r.details || {}),
      ...(r.artifactUrl ? { artifactUrl: r.artifactUrl } : {}),
    },
  }));

  return {
    id: raw.id as string,
    pipelineId: raw.pipelineId as string,
    status: raw.status as TestRun['status'],
    commitSha: raw.commitSha as string,
    branch: raw.branch as string,
    triggeredBy: raw.triggeredBy as string,
    startedAt: (raw.startedAt as string) ?? null,
    finishedAt: (raw.finishedAt as string) ?? null,
    createdAt: raw.createdAt as string,
    steps,
  };
}

export async function cancelTestRun(id: string, token?: string): Promise<TestRun> {
  return runClient<TestRun>(`/test-runs/${id}/cancel`, { method: 'POST', token });
}

export function subscribeToRun(runId: string, token?: string): EventSource {
  const url = new URL(`${PIPELINE_API_URL}/sse/runs/${runId}`);
  if (token) {
    url.searchParams.set('token', token);
  }
  return new EventSource(url.toString());
}
