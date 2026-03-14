import * as SecureStore from 'expo-secure-store';
import type { ApiError, AuthTokens } from '@/types';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001';
const ORG_API_URL =
  process.env.EXPO_PUBLIC_ORG_API_URL ?? 'http://localhost:3002';
const PROJECT_API_URL =
  process.env.EXPO_PUBLIC_PROJECT_API_URL ?? 'http://localhost:3003';
const PIPELINE_API_URL =
  process.env.EXPO_PUBLIC_PIPELINE_API_URL ?? 'http://localhost:3004';

export const SERVICE_URLS = {
  auth: API_URL,
  organizations: ORG_API_URL,
  projects: PROJECT_API_URL,
  pipelines: PIPELINE_API_URL,
} as const;

type ServiceKey = keyof typeof SERVICE_URLS;

const TOKEN_KEY = 'auth_tokens';

async function getAuthTokens(): Promise<AuthTokens | null> {
  try {
    const raw = await SecureStore.getItemAsync(TOKEN_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthTokens;
  } catch {
    return null;
  }
}

export async function saveAuthTokens(tokens: AuthTokens): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, JSON.stringify(tokens));
}

export async function clearAuthTokens(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export async function getStoredTokens(): Promise<AuthTokens | null> {
  return getAuthTokens();
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  service?: ServiceKey;
  skipAuth?: boolean;
}

export async function apiClient<T>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const { body, service = 'auth', skipAuth = false, ...fetchOptions } = options;

  const baseUrl = SERVICE_URLS[service];
  const url = `${baseUrl}${path}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchOptions.headers as Record<string, string>),
  };

  if (!skipAuth) {
    const tokens = await getAuthTokens();
    if (tokens?.accessToken) {
      headers['Authorization'] = `Bearer ${tokens.accessToken}`;
    }
  }

  const response = await fetch(url, {
    ...fetchOptions,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    let errorBody: ApiError;
    try {
      errorBody = await response.json();
    } catch {
      errorBody = {
        message: response.statusText || 'Request failed',
        statusCode: response.status,
      };
    }
    throw errorBody;
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}
