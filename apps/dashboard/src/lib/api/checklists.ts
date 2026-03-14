import { auth } from '@/lib/auth/auth';
import { AuthExpiredError } from '@/lib/api/client';

const PIPELINE_API_URL = process.env.NEXT_PUBLIC_PIPELINE_API_URL || 'http://localhost:3004';

async function checklistClient<T>(path: string, options: RequestInit & { token?: string } = {}): Promise<T> {
  const { token, ...fetchOptions } = options;

  let authToken = token;
  if (!authToken) {
    try {
      const session = await auth();
      authToken = (session as unknown as Record<string, unknown>)?.accessToken as string;
    } catch {
      // Client-side
    }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const response = await fetch(`${PIPELINE_API_URL}${path}`, { ...fetchOptions, headers });

  if (response.status === 401) {
    throw new AuthExpiredError();
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  if (response.status === 204) return undefined as T;
  return response.json();
}

// --- Types ---

export interface ChecklistItem {
  id: string;
  checklistId: string;
  title: string;
  description: string;
  expectedBehavior: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  order: number;
  generatedTestCode: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Checklist {
  id: string;
  projectId: string;
  name: string;
  description: string;
  targetUrl: string | null;
  items: ChecklistItem[];
  _count?: { runs: number };
  createdAt: string;
  updatedAt: string;
}

export interface ChecklistItemResult {
  id: string;
  runId: string;
  itemId: string;
  status: string;
  summary: string;
  details: Record<string, unknown>;
  screenshots: string[];
  durationMs: number;
  createdAt: string;
  item?: ChecklistItem;
}

export interface ChecklistRun {
  id: string;
  checklistId: string;
  targetUrl: string;
  status: string;
  triggeredBy: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  itemResults?: ChecklistItemResult[];
}

export interface ChecklistExport {
  version: string;
  name: string;
  description: string;
  targetUrl: string | null;
  items: {
    title: string;
    description: string;
    expectedBehavior: string;
    priority: string;
    generatedTestCode: string | null;
  }[];
}

// --- API ---

export async function getChecklists(projectId: string, token?: string): Promise<Checklist[]> {
  return checklistClient<Checklist[]>(`/checklists?projectId=${projectId}`, { token });
}

export async function getChecklist(id: string, token?: string): Promise<Checklist> {
  return checklistClient<Checklist>(`/checklists/${id}`, { token });
}

export async function createChecklist(data: {
  projectId: string;
  name: string;
  description?: string;
  targetUrl?: string;
  items?: { title: string; description?: string; expectedBehavior?: string; priority?: string }[];
}, token?: string): Promise<Checklist> {
  return checklistClient<Checklist>('/checklists', {
    method: 'POST',
    body: JSON.stringify(data),
    token,
  });
}

export async function updateChecklist(id: string, data: {
  name?: string;
  description?: string;
  targetUrl?: string;
}, token?: string): Promise<Checklist> {
  return checklistClient<Checklist>(`/checklists/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
    token,
  });
}

export async function deleteChecklist(id: string, token?: string): Promise<void> {
  return checklistClient<void>(`/checklists/${id}`, { method: 'DELETE', token });
}

export async function addChecklistItem(checklistId: string, data: {
  title: string;
  description?: string;
  expectedBehavior?: string;
  priority?: string;
}, token?: string): Promise<ChecklistItem> {
  return checklistClient<ChecklistItem>(`/checklists/${checklistId}/items`, {
    method: 'POST',
    body: JSON.stringify(data),
    token,
  });
}

export async function updateChecklistItem(checklistId: string, itemId: string, data: {
  title?: string;
  description?: string;
  expectedBehavior?: string;
  priority?: string;
  generatedTestCode?: string | null;
}, token?: string): Promise<ChecklistItem> {
  return checklistClient<ChecklistItem>(`/checklists/${checklistId}/items/${itemId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
    token,
  });
}

export async function deleteChecklistItem(checklistId: string, itemId: string, token?: string): Promise<void> {
  return checklistClient<void>(`/checklists/${checklistId}/items/${itemId}`, {
    method: 'DELETE',
    token,
  });
}

export async function reorderChecklistItems(checklistId: string, itemIds: string[], token?: string): Promise<void> {
  return checklistClient<void>(`/checklists/${checklistId}/items/reorder`, {
    method: 'POST',
    body: JSON.stringify({ itemIds }),
    token,
  });
}

export async function exportChecklist(id: string, token?: string): Promise<ChecklistExport> {
  return checklistClient<ChecklistExport>(`/checklists/${id}/export`, {
    method: 'POST',
    token,
  });
}

export async function importChecklist(projectId: string, data: ChecklistExport, token?: string): Promise<Checklist> {
  return checklistClient<Checklist>('/checklists/import', {
    method: 'POST',
    body: JSON.stringify({ projectId, data }),
    token,
  });
}

export async function triggerChecklistRun(checklistId: string, targetUrl: string, token?: string): Promise<ChecklistRun> {
  return checklistClient<ChecklistRun>(`/checklists/${checklistId}/run`, {
    method: 'POST',
    body: JSON.stringify({ targetUrl }),
    token,
  });
}

export async function getChecklistRun(runId: string, token?: string): Promise<ChecklistRun> {
  return checklistClient<ChecklistRun>(`/checklist-runs/${runId}`, { token });
}
