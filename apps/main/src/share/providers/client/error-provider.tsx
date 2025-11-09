/**
 * Provider 전용 에러 경계 컴포넌트
 * Provider 에러를 캐치하여 Zustand 스토어로 전달
 * 모든 UI는 ErrorOverlay에서 처리
 */

'use client';

import { ArcState } from '@/client/components/arc/ArcState';
import { useSystemShowError } from '@/client/states/stores/system-store';
import { isDevelopment } from '@/share/configs/environments/client-constants';
import { AlertCircle } from 'lucide-react';
import React, { Component, type ReactNode, useEffect } from 'react';

interface ErrorProviderState {
  hasError: boolean;
  error: Error | null;
}

interface ErrorProviderProps {
  children: ReactNode;
  providerName?: string;
  fallback?: ReactNode; // 치명적 에러 시 최소 폴백
}

/**
 * Hook을 클래스 컴포넌트와 연결하는 브릿지
 * 에러를 Zustand 스토어로 전달
 */
function ErrorBridge({
  error,
  providerName,
}: {
  error: Error;
  providerName: string;
}): null {
  const showError = useSystemShowError();

  useEffect((): void => {
    // Zustand 스토어로 에러 전달
    const errorMessage = `${providerName} 초기화 실패: ${error.message ?? '알 수 없는 오류'}`;
    const errorDetails = error.stack ?? '스택 정보 없음';

    showError(
      errorMessage,
      'critical',
      errorDetails,
      'provider' // 에러 소스 명시
    );

    // 개발 환경에서는 콘솔에도 출력
    if (isDevelopment) {
      console.error(`[ErrorBoundary - ${providerName}]`, error);
    }
  }, [error, providerName, showError]);

  return null;
}

export class ErrorProvider extends Component<
  ErrorProviderProps,
  ErrorProviderState
> {
  constructor(props: ErrorProviderProps) {
    super(props);

    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorProviderState {
    return {
      hasError: true,
      error,
    };
  }

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // 에러 로깅 (프로덕션에서는 에러 리포팅 서비스로 전송 가능)
    console.error('Provider Error Caught:', {
      error,
      errorInfo,
      provider: this.props.providerName,
    });
  }

  override render(): ReactNode {
    const { hasError, error } = this.state;
    const { children, providerName = 'Unknown', fallback } = this.props;

    if (hasError && error) {
      return (
        <>
          {/* 에러를 Zustand 스토어로 전달 */}
          <ErrorBridge error={error} providerName={providerName} />
          {/* ErrorOverlay가 표시될 수 없는 경우를 위한 최소 폴백 */}
          {fallback ?? (
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100dvh',
                width: '100dvw',
                padding: '24px',
              }}
            >
              <ArcState
                state="error"
                variant="card"
                title="시스템 오류"
                description="애플리케이션 초기화 중 치명적인 오류가 발생했습니다"
                severity="critical"
                icon={<AlertCircle />}
                details={error?.stack}
                primaryAction={{
                  label: '새로고침',
                  onClick: () => window.location.reload(),
                }}
                meta={[
                  { label: "Provider", value: providerName || 'Unknown' },
                  { label: "Error", value: error?.name || 'Unknown Error' },
                  { label: "Time", value: new Date().toLocaleString() }
                ]}
              />
            </div>
          )}
        </>
      );
    }

    return children;
  }
}
