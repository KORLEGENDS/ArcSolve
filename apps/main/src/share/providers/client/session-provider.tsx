'use client';
import type { ReactNode } from 'react';

interface SessionProviderProps {
  children: ReactNode;
  session?: unknown;
}

export function SessionProvider({
  children,
  session,
}: SessionProviderProps): ReactNode {
  // Better Auth 전환 이후에는 별도 SessionProvider가 필요하지 않으므로
  // children만 그대로 렌더링합니다.
  void session; // 향후 확장 시를 대비한 자리 표시용
  return <>{children}</>;
}
