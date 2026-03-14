import { apiClient } from './client';
import type { TestRun } from '@/types';

export async function getTestRuns(params?: {
  projectId?: string;
  orgId?: string;
  limit?: number;
  offset?: number;
}): Promise<TestRun[]> {
  const searchParams = new URLSearchParams();
  if (params?.projectId) searchParams.set('projectId', params.projectId);
  if (params?.orgId) searchParams.set('organizationId', params.orgId);
  if (params?.limit) searchParams.set('limit', String(params.limit));
  if (params?.offset) searchParams.set('offset', String(params.offset));

  const query = searchParams.toString();
  return apiClient<TestRun[]>(
    `/api/test-runs${query ? `?${query}` : ''}`,
    { service: 'pipelines' }
  );
}

export async function getTestRun(runId: string): Promise<TestRun> {
  return apiClient<TestRun>(`/api/test-runs/${runId}`, {
    service: 'pipelines',
  });
}
