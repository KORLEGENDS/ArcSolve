import { SessionProvider } from '@/share/providers/client/session-provider';
import { auth } from '@auth';
import type React from 'react';

interface InitProvidersProps {
  children: React.ReactNode;
}

export async function InitProviders({
  children,
}: InitProvidersProps): Promise<React.ReactElement> {
  // 서버에서 세션만 가져와 클라이언트 SessionProvider로 하이드레이션
  const session = await auth();

  return <SessionProvider session={session}>{children}</SessionProvider>;
}
