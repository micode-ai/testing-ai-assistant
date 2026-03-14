import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import * as SecureStore from 'expo-secure-store';
import type { AuthTokens, LoginRequest, RegisterRequest, User } from '@/types';
import * as authApi from '@/lib/api/auth';
import { clearAuthTokens, getStoredTokens } from '@/lib/api/client';
import { useAppStore } from '@/lib/stores/app-store';

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (data: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  loginWithGitHub: (code: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_KEY = 'auth_tokens';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { setUser: setStoreUser, reset: resetStore } = useAppStore();

  const isAuthenticated = !!user;

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      const tokens = await getStoredTokens();
      if (!tokens) {
        setIsLoading(false);
        return;
      }

      if (tokens.expiresAt < Date.now()) {
        try {
          await authApi.refreshToken(tokens.refreshToken);
        } catch {
          await clearAuthTokens();
          setIsLoading(false);
          return;
        }
      }

      const me = await authApi.getMe();
      setUser(me);
      setStoreUser(me);
    } catch {
      await clearAuthTokens();
    } finally {
      setIsLoading(false);
    }
  }

  const login = useCallback(async (data: LoginRequest) => {
    const response = await authApi.login(data);
    setUser(response.user);
    setStoreUser(response.user);
  }, []);

  const register = useCallback(async (data: RegisterRequest) => {
    const response = await authApi.register(data);
    setUser(response.user);
    setStoreUser(response.user);
  }, []);

  const loginWithGitHub = useCallback(async (code: string) => {
    const response = await authApi.loginWithGitHub(code);
    setUser(response.user);
    setStoreUser(response.user);
  }, []);

  const logout = useCallback(async () => {
    await clearAuthTokens();
    setUser(null);
    resetStore();
  }, []);

  const refreshToken = useCallback(async () => {
    const tokens = await getStoredTokens();
    if (!tokens?.refreshToken) {
      await logout();
      return;
    }
    try {
      await authApi.refreshToken(tokens.refreshToken);
      const me = await authApi.getMe();
      setUser(me);
      setStoreUser(me);
    } catch {
      await logout();
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated,
      isLoading,
      login,
      register,
      loginWithGitHub,
      logout,
      refreshToken,
    }),
    [user, isAuthenticated, isLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
