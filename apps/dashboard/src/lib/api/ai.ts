import { auth } from '@/lib/auth/auth';
import { AuthExpiredError } from '@/lib/api/client';
import type {
  AIGeneration,
  GenerationStats,
  GenerationType,
  TestGenSession,
  TestProposal,
  ProjectProfile,
  GeneratedTestFile,
  CommitResult,
} from '@/types';

const AI_API_URL = process.env.NEXT_PUBLIC_AI_API_URL || 'http://localhost:3005';

interface FetchOptions extends RequestInit {
  token?: string;
}

async function aiClient<T>(path: string, options: FetchOptions = {}): Promise<T> {
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

  const response = await fetch(`${AI_API_URL}${path}`, {
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

export async function triggerGeneration(data: {
  projectId: string;
  type: GenerationType;
  inputContext: Record<string, unknown>;
}, token?: string): Promise<AIGeneration> {
  return aiClient<AIGeneration>('/ai/generate', {
    method: 'POST',
    body: JSON.stringify(data),
    token,
  });
}

export async function getGenerations(
  projectId: string,
  type?: GenerationType,
  token?: string,
): Promise<AIGeneration[]> {
  const params = new URLSearchParams({ projectId });
  if (type) {
    params.set('type', type);
  }
  return aiClient<AIGeneration[]>(`/ai/generations?${params.toString()}`, { token });
}

export async function getGeneration(id: string, token?: string): Promise<AIGeneration> {
  return aiClient<AIGeneration>(`/ai/generations/${id}`, { token });
}

export async function submitFeedback(
  id: string,
  accepted: boolean,
  feedback?: string,
  token?: string,
): Promise<void> {
  return aiClient<void>(`/ai/generations/${id}/feedback`, {
    method: 'POST',
    body: JSON.stringify({ accepted, feedback }),
    token,
  });
}

export async function getGenerationStats(projectId: string, token?: string): Promise<GenerationStats> {
  return aiClient<GenerationStats>(`/ai/generations/stats?projectId=${projectId}`, { token });
}

// --- Test Gen Session API ---

export async function startTestGenSession(
  projectId: string,
  token?: string,
  locale?: string,
): Promise<TestGenSession> {
  return aiClient<TestGenSession>('/ai/test-gen-sessions', {
    method: 'POST',
    body: JSON.stringify({ projectId, locale }),
    token,
  });
}

export async function getTestGenSession(
  id: string,
  token?: string,
): Promise<TestGenSession> {
  return aiClient<TestGenSession>(`/ai/test-gen-sessions/${id}`, { token });
}

export async function getTestGenSessions(
  projectId: string,
  token?: string,
): Promise<TestGenSession[]> {
  return aiClient<TestGenSession[]>(
    `/ai/test-gen-sessions?projectId=${projectId}`,
    { token },
  );
}

export async function getProjectProfile(
  projectId: string,
  token?: string,
): Promise<ProjectProfile> {
  return aiClient<ProjectProfile>(
    `/ai/test-gen-sessions/profile/${projectId}`,
    { token },
  );
}

export async function generateTestProposal(
  sessionId: string,
  focusArea?: string,
  token?: string,
  locale?: string,
): Promise<TestProposal> {
  return aiClient<TestProposal>(`/ai/test-gen-sessions/${sessionId}/propose`, {
    method: 'POST',
    body: JSON.stringify({ focusArea, locale }),
    token,
  });
}

export async function approveTestProposal(
  sessionId: string,
  approvedItemIds: string[],
  token?: string,
): Promise<{ approvedCount: number }> {
  return aiClient<{ approvedCount: number }>(
    `/ai/test-gen-sessions/${sessionId}/approve`,
    {
      method: 'POST',
      body: JSON.stringify({ approvedItemIds }),
      token,
    },
  );
}

export async function generateApprovedTests(
  sessionId: string,
  token?: string,
): Promise<GeneratedTestFile[]> {
  return aiClient<GeneratedTestFile[]>(
    `/ai/test-gen-sessions/${sessionId}/generate`,
    {
      method: 'POST',
      token,
    },
  );
}

export async function updateGeneratedTests(
  sessionId: string,
  tests: GeneratedTestFile[],
  token?: string,
): Promise<GeneratedTestFile[]> {
  return aiClient<GeneratedTestFile[]>(
    `/ai/test-gen-sessions/${sessionId}/tests`,
    {
      method: 'PATCH',
      body: JSON.stringify({ tests }),
      token,
    },
  );
}

export async function commitTests(
  sessionId: string,
  options: { createPR?: boolean; commitMessage?: string } = {},
  token?: string,
): Promise<CommitResult> {
  return aiClient<CommitResult>(
    `/ai/test-gen-sessions/${sessionId}/commit`,
    {
      method: 'POST',
      body: JSON.stringify(options),
      token,
    },
  );
}
