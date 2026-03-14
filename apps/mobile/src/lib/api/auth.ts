import { apiClient, saveAuthTokens } from './client';
import type { AuthTokens, LoginRequest, RegisterRequest, User } from '@/types';

interface AuthResponse {
  user: User;
  tokens: AuthTokens;
}

export async function login(data: LoginRequest): Promise<AuthResponse> {
  const response = await apiClient<AuthResponse>('/api/auth/login', {
    method: 'POST',
    body: data,
    skipAuth: true,
  });
  await saveAuthTokens(response.tokens);
  return response;
}

export async function register(data: RegisterRequest): Promise<AuthResponse> {
  const response = await apiClient<AuthResponse>('/api/auth/register', {
    method: 'POST',
    body: data,
    skipAuth: true,
  });
  await saveAuthTokens(response.tokens);
  return response;
}

export async function refreshToken(token: string): Promise<AuthTokens> {
  const response = await apiClient<AuthTokens>('/api/auth/refresh', {
    method: 'POST',
    body: { refreshToken: token },
    skipAuth: true,
  });
  await saveAuthTokens(response);
  return response;
}

export async function getMe(): Promise<User> {
  return apiClient<User>('/api/auth/me');
}

export async function loginWithGitHub(code: string): Promise<AuthResponse> {
  const response = await apiClient<AuthResponse>('/api/auth/github/callback', {
    method: 'POST',
    body: { code },
    skipAuth: true,
  });
  await saveAuthTokens(response.tokens);
  return response;
}
