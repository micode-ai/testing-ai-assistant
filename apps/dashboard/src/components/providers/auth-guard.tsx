'use client';

import { useEffect, useCallback } from 'react';
import { useSession, signOut } from 'next-auth/react';

/**
 * Monitors the session and redirects to login when the token expires.
 * Also sets up a global handler for 401 errors from API calls.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();

  const handleSignOut = useCallback(() => {
    signOut({ callbackUrl: '/login' });
  }, []);

  // Redirect if session was lost or refresh token expired
  useEffect(() => {
    if (status === 'unauthenticated') {
      handleSignOut();
      return;
    }
    // Check if JWT callback marked the token as expired
    const error = (session as unknown as Record<string, unknown>)?.error;
    if (error === 'RefreshTokenExpired') {
      handleSignOut();
    }
  }, [status, session, handleSignOut]);

  // Global listener for AuthExpiredError thrown by API clients
  useEffect(() => {
    function handleUnhandledRejection(event: PromiseRejectionEvent) {
      if (event.reason?.name === 'AuthExpiredError') {
        event.preventDefault();
        handleSignOut();
      }
    }

    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    return () => window.removeEventListener('unhandledrejection', handleUnhandledRejection);
  }, [handleSignOut]);

  // Periodic session check — re-validate every 60 seconds
  useEffect(() => {
    if (status !== 'authenticated') return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/auth/session');
        const data = await res.json();
        if (!data?.user) {
          handleSignOut();
        }
      } catch {
        // Network error, skip
      }
    }, 60_000);

    return () => clearInterval(interval);
  }, [status, handleSignOut]);

  return <>{children}</>;
}
