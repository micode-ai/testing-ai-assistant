import { apiClient } from './client';
import type { Organization } from '@/types';

export async function getOrganizations(): Promise<Organization[]> {
  return apiClient<Organization[]>('/api/organizations', {
    service: 'organizations',
  });
}

export async function getOrganization(id: string): Promise<Organization> {
  return apiClient<Organization>(`/api/organizations/${id}`, {
    service: 'organizations',
  });
}
