/**
 * NextAuth.js v5 Session Provider
 * 2025년 6월 기준 최신 안정 버전
 */

'use client';

import type { Session } from 'next-auth';
import { SessionProvider as NextAuthSessionProvider } from 'next-auth/react';
import type { ReactNode } from 'react';

interface SessionProviderProps {
  children: ReactNode;
  session?: Session | null;
}

export function SessionProvider({
  children,
  session,
}: SessionProviderProps): ReactNode {
  return (
    <NextAuthSessionProvider
      session={session ?? null}
      refetchInterval={0}
      refetchOnWindowFocus={false}
      refetchWhenOffline={false}
    >
      {children}
    </NextAuthSessionProvider>
  );
}
