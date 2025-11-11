'use client';

import { ArcState } from '@/client/components/arc/ArcState';
import dynamic from 'next/dynamic';

/**
 * ArcWork를 다이나믹 로드한 버전 (코드 스플리팅 적용)
 * SSR 비활성화로 클라이언트에서만 렌더링됩니다.
 * 실제 코드 스플리팅을 위해 import()를 사용합니다.
 */
export const ArcWorkDynamic = dynamic(
  () => import('./ArcWork').then((mod) => ({ default: mod.ArcWork })),
  {
    ssr: false,
    loading: () => (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <ArcState
          state="loading"
          variant="card"
          title="로딩 중입니다"
          description="ArcWork 컴포넌트를 불러오는 중입니다. 잠시만 기다려 주세요."
          severity="info"
        />
      </div>
    ),
  }
);

