import { apiClient } from './client';
import type { Project } from '@/types';

export async function getProjects(orgId: string): Promise<Project[]> {
  return apiClient<Project[]>(`/api/projects?organizationId=${orgId}`, {
    service: 'projects',
  });
}

export async function getProject(projectId: string): Promise<Project> {
  return apiClient<Project>(`/api/projects/${projectId}`, {
    service: 'projects',
  });
}
