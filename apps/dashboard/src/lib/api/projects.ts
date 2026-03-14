import { auth } from '@/lib/auth/auth';
import { Project } from '@/types';

const PROJECT_API_URL = process.env.NEXT_PUBLIC_PROJECT_API_URL || 'http://localhost:3003';

async function projectClient<T>(path: string, options: RequestInit & { token?: string } = {}): Promise<T> {
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

  const response = await fetch(`${PROJECT_API_URL}${path}`, {
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

export async function getProjects(orgId: string, token?: string): Promise<Project[]> {
  return projectClient<Project[]>(`/projects?orgId=${orgId}`, { token });
}

export async function getProject(id: string, token?: string): Promise<Project> {
  return projectClient<Project>(`/projects/${id}`, { token });
}

export async function createProject(
  data: { name: string; repoUrl: string; repoProvider: string; defaultBranch: string; orgId: string },
  token?: string,
): Promise<Project> {
  return projectClient<Project>('/projects', {
    method: 'POST',
    body: JSON.stringify(data),
    token,
  });
}

export async function updateProject(
  id: string,
  data: { name?: string; repoUrl?: string; defaultBranch?: string },
  token?: string,
): Promise<Project> {
  return projectClient<Project>(`/projects/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
    token,
  });
}

export async function deleteProject(id: string, token?: string): Promise<void> {
  return projectClient<void>(`/projects/${id}`, { method: 'DELETE', token });
}

export async function connectWebhook(projectId: string, token?: string): Promise<Project> {
  return projectClient<Project>(`/projects/${projectId}/webhook/connect`, {
    method: 'POST',
    token,
  });
}

export async function disconnectWebhook(projectId: string, token?: string): Promise<Project> {
  return projectClient<Project>(`/projects/${projectId}/webhook/disconnect`, {
    method: 'POST',
    token,
  });
}
