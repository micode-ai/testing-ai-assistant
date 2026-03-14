import type { NextAuthConfig } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import GitHub from 'next-auth/providers/github';

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
      if (user) {
        token.accessToken = (user as Record<string, string>).accessToken;
        token.refreshToken = (user as Record<string, string>).refreshToken;
        token.userId = (user as Record<string, string>).id;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.userId as string;
      (session as unknown as Record<string, unknown>).accessToken = token.accessToken;
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
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

        const res = await fetch(`${apiUrl}/auth/login`, {
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
