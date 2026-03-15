import type { NextAuthConfig } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import GitHub from 'next-auth/providers/github';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

/**
 * Decodes a JWT payload to check expiration without verifying signature.
 * Returns the expiration timestamp in milliseconds.
 */
function getJwtExpiration(token: string): number {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    return (payload.exp ?? 0) * 1000;
  } catch {
    return 0;
  }
}

/**
 * Refreshes the access token using the refresh token.
 */
async function refreshAccessToken(refreshToken: string): Promise<{
  accessToken: string;
  refreshToken: string;
} | null> {
  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) return null;

    const data = await res.json();
    return {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
    };
  } catch {
    return null;
  }
}

export const authConfig: NextAuthConfig = {
  pages: {
    signIn: '/login',
    error: '/auth-error',
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnDashboard = nextUrl.pathname.startsWith('/dashboard') || nextUrl.pathname.startsWith('/organizations');

      if (isOnDashboard) {
        if (isLoggedIn) return true;
        return false;
      }

      if (isLoggedIn && (nextUrl.pathname === '/login' || nextUrl.pathname === '/register')) {
        return Response.redirect(new URL('/organizations', nextUrl));
      }

      return true;
    },
    async jwt({ token, user }) {
      // Initial sign-in: store tokens
      if (user) {
        token.accessToken = (user as Record<string, string>).accessToken;
        token.refreshToken = (user as Record<string, string>).refreshToken;
        token.userId = (user as Record<string, string>).id;
        token.accessTokenExpires = getJwtExpiration(token.accessToken as string);
        return token;
      }

      // Return existing token if not expired (with 60s buffer)
      const expiresAt = (token.accessTokenExpires as number) || 0;
      if (Date.now() < expiresAt - 60_000) {
        return token;
      }

      // Access token expired — try to refresh
      const refreshed = await refreshAccessToken(token.refreshToken as string);
      if (refreshed) {
        token.accessToken = refreshed.accessToken;
        token.refreshToken = refreshed.refreshToken;
        token.accessTokenExpires = getJwtExpiration(refreshed.accessToken);
        return token;
      }

      // Refresh failed — mark token as expired so session becomes invalid
      token.error = 'RefreshTokenExpired';
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.userId as string;
      (session as unknown as Record<string, unknown>).accessToken = token.accessToken;
      (session as unknown as Record<string, unknown>).error = token.error;
      return session;
    },
  },
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const res = await fetch(`${API_URL}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: credentials?.email,
            password: credentials?.password,
          }),
        });

        if (!res.ok) return null;

        const data = await res.json();
        return {
          id: data.user.id,
          email: data.user.email,
          name: data.user.name,
          image: data.user.avatarUrl,
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
        };
      },
    }),
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
    }),
  ],
};
