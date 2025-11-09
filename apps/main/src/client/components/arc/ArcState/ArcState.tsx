'use client';

import { CopyButton } from '@/client/components/ui/custom/copy-button';
import React, { type ReactNode } from 'react';
import { toast as sonnerToast } from 'sonner';
import styles from './ArcState.module.css';

// ============================================================
// 타입 정의
// ============================================================

/**
 * ArcState 컴포넌트의 상태 종류
 */
export type ArcStateKind =
  | 'loading'
  | 'error'
  | 'empty'
  | 'success'
  | 'offline'
  | 'maintenance';

/**
 * ArcState 컴포넌트의 표시 방식
 */
export type ArcStateVariant = 'inline' | 'card';

/**
 * ArcState 컴포넌트의 심각도 수준
 */
export type ArcStateSeverity = 'critical' | 'warning' | 'info' | 'success';

/**
 * ArcState 컴포넌트의 액션 정의
 */
export interface ArcStateAction {
  label: string;
  onClick: () => void;
  /** 복사할 텍스트 (지정 시 복사 버튼으로 동작) */
  copyText?: string;
  /** 복사 완료 콜백 */
  onCopyComplete?: (success: boolean) => void;
}

/**
 * ArcState 컴포넌트의 메타 정보 항목
 */
export interface ArcStateMetaItem {
  label: string;
  value: string;
}

/** ArcState 상태별 토스트 설정 항목 */
export type ArcStateToastAction = {
  label: string;
  onClick: () => void;
};

export type ArcStateToastItem = {
  title: string;
  description?: string;
  type?: 'success' | 'error' | 'warning' | 'info' | 'message';
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top-center' | 'bottom-center';
  duration?: number;
  action?: ArcStateToastAction;
  cancel?: ArcStateToastAction;
};

/** ArcState 전역 토스트 옵션 */
export type ArcStateToastOptions = {
  on?: Partial<Record<ArcStateKind, ArcStateToastItem>>;
  /** loading 상태를 지속 토스트로 노출하고, 상태 종료 시 자동 해제 */
  persistLoading?: boolean;
  /** 공통 기본 위치 (개별 항목 position이 우선) */
  position?: ArcStateToastItem['position'];
  /** 공통 기본 duration (개별 항목 duration이 우선) */
  duration?: number;
  /** 토스트 ID 스코프 식별자 (선택) */
  id?: string;
  /** 새 토스트 표출 전 기존 토스트 정리 */
  clearBeforeShow?: boolean;
  /** 상태 변화 시 자동 토스트 표출 여부 (기본 true 가정) */
  auto?: boolean;
};

/**
 * ArcState 컴포넌트의 Props 인터페이스
 */
export interface ArcStateProps {
  state: ArcStateKind;
  variant: ArcStateVariant;
  title: string;
  description: string;
  severity?: ArcStateSeverity;
  meta?: ArcStateMetaItem[];
  details?: string;
  primaryAction?: ArcStateAction;
  secondaryActions?: ArcStateAction[];
  icon?: ReactNode;
  className?: string;
  /** 상태 변화에 따른 토스트 자동 표출 옵션 (선택) */
  toast?: ArcStateToastOptions;
}

// ============================================================
// 상수 및 설정
// ============================================================

type ToastType = 'success' | 'error' | 'warning' | 'info' | 'message' | 'loading';

type ToastConfig = {
  style: React.CSSProperties;
  toastFn: typeof sonnerToast.success;
};

const TOAST_CONFIG: Record<ToastType, ToastConfig> = {
  success: {
    style: {
      border: '1px solid var(--color-emerald-500)',
      boxShadow: '0 0 10px color-mix(in oklab, var(--color-emerald-500) 10%, transparent)',
    },
    toastFn: sonnerToast.success,
  },
  error: {
    style: {
      border: '1px solid var(--color-destructive)',
      boxShadow: '0 0 10px color-mix(in oklab, var(--color-destructive) 10%, transparent)',
    },
    toastFn: sonnerToast.error,
  },
  warning: {
    style: {
      border: '1px solid var(--color-amber-500)',
      boxShadow: '0 0 10px color-mix(in oklab, var(--color-amber-500) 10%, transparent)',
    },
    toastFn: sonnerToast.warning,
  },
  info: {
    style: {
      border: '1px solid var(--color-border)',
    },
    toastFn: sonnerToast.info,
  },
  message: {
    style: {
      border: '1px solid var(--color-border)',
    },
    toastFn: sonnerToast.message,
  },
  loading: {
    style: {
      border: '1px solid var(--color-accent)',
      boxShadow: '0 0 8px color-mix(in oklab, var(--color-accent) 8%, transparent)',
    },
    toastFn: sonnerToast.message, // loading은 message 함수 사용
  },
};

// ============================================================
// 유틸리티 함수
// ============================================================

/**
 * 토스트를 표시하는 헬퍼 함수
 */
function showToast(
  type: ToastType,
  title: string,
  options: {
    description?: string;
    position?: ArcStateToastItem['position'];
    duration?: number;
    action?: ArcStateToastAction;
    cancel?: ArcStateToastAction;
    clearBefore?: boolean;
  }
): string | number {
  if (options.clearBefore) {
    sonnerToast.dismiss();
  }

  const config = TOAST_CONFIG[type];
  const position = options.position ?? 'bottom-left';

  return config.toastFn(title, {
    description: options.description,
    position,
    duration: options.duration,
    action: options.action,
    cancel: options.cancel,
    style: config.style,
  }) as string | number;
}

// ============================================================
// 컴포넌트
// ============================================================

export function ArcState({
  state,
  variant,
  title,
  description,
  severity,
  meta,
  details,
  primaryAction,
  secondaryActions,
  icon,
  className,
  toast,
}: ArcStateProps): React.ReactElement {
  const isError = state === 'error';
  const isBusy = state === 'loading';
  const role = isError ? 'alert' : 'status';
  const ariaLive = isError ? 'assertive' : 'polite';

  // =============== 상태 기반 토스트: 최소 로직 ===============
  const prevStateRef = React.useRef<ArcStateKind | null>(null);
  const loadingToastIdRef = React.useRef<string | number | null>(null);

  React.useEffect(() => {
    const opts = toast as ArcStateToastOptions | undefined;
    const curr = state;
    const prev = prevStateRef.current;

    if (!opts) {
      prevStateRef.current = curr;
      return;
    }

    // auto 옵션이 명시적으로 false면 자동 토스트 비활성화
    if (opts.auto === false) {
      prevStateRef.current = curr;
      return;
    }

    // 1) persist loading
    if (opts.persistLoading) {
      if (curr === 'loading' && !loadingToastIdRef.current) {
        const id = showToast('loading', opts.on?.loading?.title ?? '처리 중...', {
          description: opts.on?.loading?.description,
          position: opts.on?.loading?.position ?? opts.position,
          duration: Infinity,
          action: opts.on?.loading?.action,
          cancel: opts.on?.loading?.cancel,
          clearBefore: opts.clearBeforeShow,
        });
        loadingToastIdRef.current = id;
      }
      if (prev === 'loading' && curr !== 'loading' && loadingToastIdRef.current) {
        sonnerToast.dismiss(loadingToastIdRef.current);
        loadingToastIdRef.current = null;
      }
    }

    // 2) state-mapped toast
    const cfg = opts.on?.[curr as ArcStateKind];
    if (cfg) {
      const type = cfg.type ?? (curr === 'error' ? 'error' : curr === 'success' ? 'success' : 'info');
      showToast(type, cfg.title, {
        description: cfg.description,
        position: cfg.position ?? opts.position,
        duration: cfg.duration ?? opts.duration,
        action: cfg.action,
        cancel: cfg.cancel,
        clearBefore: opts.clearBeforeShow,
      });
    }

    prevStateRef.current = curr;
  }, [state, toast]);

  const classes = [
    styles.container,
    variant === 'inline' ? styles.isInline : undefined,
    variant === 'card' ? styles.isCard : undefined,
    severity === 'critical' ? styles.sevCritical : undefined,
    severity === 'warning' ? styles.sevWarning : undefined,
    severity === 'info' ? styles.sevInfo : undefined,
    severity === 'success' ? styles.sevSuccess : undefined,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const hasActions = Boolean(primaryAction) || ((secondaryActions?.length ?? 0) > 0);

  return (
    <div
      className={classes}
      role={role}
      aria-busy={isBusy || undefined}
      aria-live={ariaLive}
      data-state={state}
      data-variant={variant}
      data-severity={severity ?? undefined}
    >
      <div className={styles.content}>
        {icon && (
          <div className={styles.icon} aria-hidden>
            {icon}
          </div>
        )}

        <div className={styles.title}>{title}</div>
        <div className={styles.description}>{description}</div>

        {meta && meta.length > 0 && (
          <div className={styles.meta}>
            {meta.map((m, idx) => (
              <div key={`${m.label}-${idx}`} className={styles.metaItem}>
                <span className={styles.metaLabel}>{m.label}</span>
                <span className={styles.metaValue}>{m.value}</span>
              </div>
            ))}
          </div>
        )}

        {details && (
          <div className={styles.details}>
            <pre>{details}</pre>
          </div>
        )}

        {hasActions && (
          <div className={styles.actions}>
            {primaryAction && (
              <button className={styles.primaryButton} onClick={primaryAction.onClick}>
                {primaryAction.label}
              </button>
            )}
            {secondaryActions?.map((a, idx) => {
                const actionKey = `${a.label}-${idx}`;

                // copyText가 있으면 CopyButton 사용
                if (a.copyText) {
                  return (
                    <CopyButton
                      key={actionKey}
                      text={a.copyText}
                      className={styles.secondaryButton}
                      onCopyComplete={a.onCopyComplete}
                    >
                      {a.label}
                    </CopyButton>
                  );
                }

                // 일반 버튼
                return (
                  <button
                    key={actionKey}
                    className={styles.secondaryButton}
                    onClick={a.onClick}
                  >
                    {a.label}
                  </button>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
}
