import { apiClient } from './client';
import { User } from '@/types';

interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

interface RegisterInput {
  email: string;
  name: string;
  password: string;
}

export async function registerUser(data: RegisterInput): Promise<AuthResponse> {
  return apiClient<AuthResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getCurrentUser(token?: string): Promise<User> {
  return apiClient<User>('/auth/me', { token });
}
