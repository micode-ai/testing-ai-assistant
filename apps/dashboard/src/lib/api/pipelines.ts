import { auth } from '@/lib/auth/auth';
import { Pipeline } from '@/types';

const PIPELINE_API_URL = process.env.NEXT_PUBLIC_PIPELINE_API_URL || 'http://localhost:3004';

async function pipelineClient<T>(path: string, options: RequestInit & { token?: string } = {}): Promise<T> {
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

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

export async function getPipelines(projectId: string, token?: string): Promise<Pipeline[]> {
  const raw = await pipelineClient<Record<string, unknown>[]>(`/pipelines?projectId=${projectId}`, { token });
  return raw.map(normalizePipeline);
}

export async function getPipeline(id: string, token?: string): Promise<Pipeline> {
  const raw = await pipelineClient<Record<string, unknown>>(`/pipelines/${id}`, { token });
  return normalizePipeline(raw);
}

function normalizePipeline(raw: Record<string, unknown>): Pipeline {
  return {
    ...raw,
    triggerType: (raw.triggerType ?? raw.trigger) as Pipeline['triggerType'],
    cronExpression: (raw.cronExpression ?? raw.cronExpr ?? null) as string | null,
  } as Pipeline;
}

export async function createPipeline(
  data: {
    projectId: string;
    name: string;
    triggerType: string;
    cronExpression?: string;
    steps: { name: string; checkType: string; config?: Record<string, unknown>; order: number }[];
  },
  token?: string,
): Promise<Pipeline> {
  const { triggerType, cronExpression, ...rest } = data;
  return pipelineClient<Pipeline>('/pipelines', {
    method: 'POST',
    body: JSON.stringify({
      ...rest,
      trigger: triggerType,
      cronExpr: cronExpression,
    }),
    token,
  });
}

export async function updatePipeline(
  id: string,
  data: {
    name?: string;
    enabled?: boolean;
    triggerType?: string;
    cronExpression?: string;
    steps?: { name: string; checkType: string; config?: Record<string, unknown>; order: number }[];
  },
  token?: string,
): Promise<Pipeline> {
  const { triggerType, cronExpression, ...rest } = data;
  const payload: Record<string, unknown> = { ...rest };
  if (triggerType !== undefined) payload.trigger = triggerType;
  if (cronExpression !== undefined) payload.cronExpr = cronExpression;
  const raw = await pipelineClient<Record<string, unknown>>(`/pipelines/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
    token,
  });
  return normalizePipeline(raw);
}

export async function deletePipeline(id: string, token?: string): Promise<void> {
  return pipelineClient<void>(`/pipelines/${id}`, { method: 'DELETE', token });
}

export async function triggerRun(
  pipelineId: string,
  data: { commitSha?: string; branch?: string },
  token?: string,
): Promise<{ id: string }> {
  return pipelineClient<{ id: string }>('/test-runs', {
    method: 'POST',
    body: JSON.stringify({
      pipelineId,
      commitSha: data.commitSha || `manual-${Date.now().toString(36)}`,
      branch: data.branch || 'main',
    }),
    token,
  });
}
