import { auth } from '@/lib/auth/auth';
import type { NotificationConfig } from '@/types';

const NOTIFICATION_API_URL = process.env.NEXT_PUBLIC_NOTIFICATION_API_URL || 'http://localhost:3006';

async function notificationClient<T>(path: string, options: RequestInit & { token?: string } = {}): Promise<T> {
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

  const response = await fetch(`${NOTIFICATION_API_URL}${path}`, {
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

export async function getNotificationConfigs(orgId: string, token?: string): Promise<NotificationConfig[]> {
  return notificationClient<NotificationConfig[]>(`/configs?orgId=${orgId}`, { token });
}

export async function createNotificationConfig(
  data: { orgId: string; channel: string; event: string; config: Record<string, unknown>; enabled: boolean },
  token?: string,
): Promise<NotificationConfig> {
  return notificationClient<NotificationConfig>('/configs', {
    method: 'POST',
    body: JSON.stringify(data),
    token,
  });
}

export async function updateNotificationConfig(
  id: string,
  data: Partial<{ channel: string; event: string; config: Record<string, unknown>; enabled: boolean }>,
  token?: string,
): Promise<NotificationConfig> {
  return notificationClient<NotificationConfig>(`/configs/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
    token,
  });
}

export async function deleteNotificationConfig(id: string, token?: string): Promise<void> {
  return notificationClient<void>(`/configs/${id}`, { method: 'DELETE', token });
}
