import { auth } from '@/lib/auth/auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface FetchOptions extends RequestInit {
  token?: string;
  baseUrl?: string;
}

export async function apiClient<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const { token, baseUrl, ...fetchOptions } = options;

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

  const response = await fetch(`${baseUrl || API_URL}${path}`, {
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
