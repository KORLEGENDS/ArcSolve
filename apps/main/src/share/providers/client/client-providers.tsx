/**
 * 통합 AppProviders - 의존성 기반 Provider 순서
??
 */

'use client';

// Immer MapSet 플러그인 활성화 - Store에서 Map 사용을 위해 필요
import { enableMapSet } from 'immer';
enableMapSet();

import { TooltipProvider } from '@/client/components/ui/tooltip';
import { useSystemStore } from '@/client/states/stores/system-store';
import { useTheme } from 'next-themes';
import { type ComponentType, type ReactNode, Suspense, useEffect, useMemo, useRef } from 'react';
import { toast as sonnerToast, Toaster } from 'sonner';
import {
  type ComposedProviderProps,
  composeProviders,
  type ProviderConfig,
} from '../providers-utils/app-provider-utils';
import { AuthProvider } from './auth-provider';
import { ErrorProvider } from './error-provider';
import { IntlProvider, type IntlProviderProps } from './intl-provider';
import { NetworkProvider } from './network-provider';
import { QueryProvider } from './query-provider';
import { StyleProvider } from './style-provider';
import { ThemeProvider } from './theme-provider';

/**
 * 기본 Provider Props 인터페이스
 */
export interface AppProvidersProps {
  children: ReactNode;
  intl?: Pick<IntlProviderProps, 'messages' | 'locale' | 'timeZone' | 'now'>;
}

// NetworkInformation 타입 및 Navigator 전역 확장은 `NetworkProvider`로 이동

// 제거: NetworkMonitor는 실제 동작이 없는 빈 컴포넌트로, 불필요하여 삭제

export function AppProviders({ children, intl }: AppProvidersProps): ReactNode {
  const { theme = 'system' } = useTheme();
  // Provider 설정을 useMemo로 최적화
  const ComposedProviders =
    useMemo((): ComponentType<ComposedProviderProps> => {
      // 정적 Provider 설정 (동적 props가 필요한 SessionProvider 제외)
      const staticProviders: ProviderConfig<any>[] = [
        [ErrorProvider, { providerName: 'AppProviders' }],
        [StyleProvider, {}],
        [ThemeProvider, {}],
        // i18n Provider (서버에서 전달된 메시지/로케일)
        [IntlProvider, intl ?? { messages: {}, locale: 'ko' }],
        [QueryProvider, {}],
        [TooltipProvider, { delayDuration: 150 }],
      ];

      return composeProviders(staticProviders);
    }, [intl]);

  // 전역 시스템 상태 구독
  const loading = useSystemStore((s) => s.loading);
  const error = useSystemStore((s) => s.error);
  const network = useSystemStore((s) => s.networkStatus);

  // 전역 로딩 토스트 (지속형)
  const loadingToastIdRef = useRef<string | number | null>(null);
  useEffect(() => {
    if (loading.active && !loadingToastIdRef.current) {
      loadingToastIdRef.current = sonnerToast.message(loading.text || '로딩 중…', {
        description: '잠시만 기다려주세요',
        position: 'bottom-left',
        duration: Infinity,
      });
    }
    if (!loading.active && loadingToastIdRef.current) {
      sonnerToast.dismiss(loadingToastIdRef.current);
      loadingToastIdRef.current = null;
    }
  }, [loading.active, loading.text]);

  // 네트워크 상태 변화 토스트 안내 (배너 대체)
  useEffect(() => {
    if (network.status === 'offline') {
      sonnerToast.warning('오프라인 상태입니다.', { position: 'top-center' });
    } else if (network.status === 'slow') {
      sonnerToast.info('네트워크가 느립니다.', { position: 'top-center' });
    } else if (network.status === 'online') {
      sonnerToast.success('온라인으로 복구되었습니다.', { position: 'top-center', duration: 1500 });
    }
  }, [network.status]);

  return (
    <NetworkProvider>
      <ComposedProviders>
        <Suspense
          fallback={
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100dvh',
                width: '100dvw',
                color: 'var(--color-card-foreground)',
              }}
            >
              로딩 중...
            </div>
          }
        >
          {/* AuthProvider는 내부에서 라우터 관련 훅(useSearchParams 등)을 사용하므로
              Suspense 내부에서 감싸서 클라이언트 전용 렌더링 경로로 안전하게 만듭니다. */}
          <AuthProvider>{children}</AuthProvider>
          {/* 전역 오버레이 제거: 에러는 토스트로 노출 */}
          {error.active && !!error.message && (
            sonnerToast.error('오류가 발생했습니다', {
              description: error.message,
              position: 'bottom-left',
              action: {
                label: '새로고침',
                onClick: () => window.location.reload(),
              },
            })
          )}
          {/* 전역 토스트 렌더러: 좌하단 고정 (권장 방식: toastOptions.style 사용) */}
          <Toaster
            theme={theme as any}
            position='bottom-left'
            closeButton
            duration={2500}
            toastOptions={{
              style: {
                backgroundColor: 'var(--color-popover)',
                color: 'var(--color-popover-foreground)',
                borderRadius: 'var(--radius-md)'
              }
            }}
          />
        </Suspense>
      </ComposedProviders>
    </NetworkProvider>
  );
}
