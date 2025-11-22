import type React from 'react';

interface InitProvidersProps {
  children: React.ReactNode;
}

export async function InitProviders({
  children,
}: InitProvidersProps): Promise<React.ReactElement> {
  // Better Auth 전환 이후에는 별도 세션 하이드레이션 없이
  // 클라이언트 authClient가 자체적으로 세션을 관리합니다.
  return <>{children}</>;
}
