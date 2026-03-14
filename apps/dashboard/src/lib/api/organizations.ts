import { apiClient } from './client';
import { Organization, Membership } from '@/types';

const ORG_API_URL = process.env.NEXT_PUBLIC_ORG_API_URL || 'http://localhost:3002';

export async function getOrganizations(): Promise<Organization[]> {
  return apiClient<Organization[]>('/organizations', { baseUrl: ORG_API_URL });
}

export async function getOrganization(id: string): Promise<Organization> {
  return apiClient<Organization>(`/organizations/${id}`, { baseUrl: ORG_API_URL });
}

export async function createOrganization(data: { name: string }): Promise<Organization> {
  return apiClient<Organization>('/organizations', {
    method: 'POST',
    body: JSON.stringify(data),
    baseUrl: ORG_API_URL,
  });
}

export async function updateOrganization(id: string, data: { name?: string }): Promise<Organization> {
  return apiClient<Organization>(`/organizations/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
    baseUrl: ORG_API_URL,
  });
}

export async function deleteOrganization(id: string): Promise<void> {
  return apiClient<void>(`/organizations/${id}`, { method: 'DELETE', baseUrl: ORG_API_URL });
}

export async function getMembers(orgId: string): Promise<Membership[]> {
  return apiClient<Membership[]>(`/organizations/${orgId}/members`, { baseUrl: ORG_API_URL });
}

export async function inviteMember(orgId: string, data: { userId: string; role?: string }): Promise<Membership> {
  return apiClient<Membership>(`/organizations/${orgId}/members/invite`, {
    method: 'POST',
    body: JSON.stringify(data),
    baseUrl: ORG_API_URL,
  });
}

export async function approveMember(orgId: string, memberId: string): Promise<Membership> {
  return apiClient<Membership>(`/organizations/${orgId}/members/${memberId}/approve`, { method: 'PATCH', baseUrl: ORG_API_URL });
}

export async function rejectMember(orgId: string, memberId: string): Promise<Membership> {
  return apiClient<Membership>(`/organizations/${orgId}/members/${memberId}/reject`, { method: 'PATCH', baseUrl: ORG_API_URL });
}

export async function changeMemberRole(orgId: string, memberId: string, role: string): Promise<Membership> {
  return apiClient<Membership>(`/organizations/${orgId}/members/${memberId}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
    baseUrl: ORG_API_URL,
  });
}

export async function removeMember(orgId: string, memberId: string): Promise<void> {
  return apiClient<void>(`/organizations/${orgId}/members/${memberId}`, { method: 'DELETE', baseUrl: ORG_API_URL });
}
