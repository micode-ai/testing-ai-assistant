import { auth } from '@/lib/auth/auth';
import { AuthExpiredError } from '@/lib/api/client';
import type { AIGeneration, GenerationStats, GenerationType } from '@/types';

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
}): Promise<AIGeneration> {
  return aiClient<AIGeneration>('/generations', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getGenerations(
  projectId: string,
  type?: GenerationType,
): Promise<AIGeneration[]> {
  const params = new URLSearchParams({ projectId });
  if (type) {
    params.set('type', type);
  }
  return aiClient<AIGeneration[]>(`/generations?${params.toString()}`);
}

export async function getGeneration(id: string): Promise<AIGeneration> {
  return aiClient<AIGeneration>(`/generations/${id}`);
}

export async function submitFeedback(
  id: string,
  accepted: boolean,
  feedback?: string,
): Promise<void> {
  return aiClient<void>(`/generations/${id}/feedback`, {
    method: 'POST',
    body: JSON.stringify({ accepted, feedback }),
  });
}

export async function getGenerationStats(projectId: string): Promise<GenerationStats> {
  return aiClient<GenerationStats>(`/generations/stats?projectId=${projectId}`);
}
