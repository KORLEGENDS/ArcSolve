'use client';

import { useCopyToClipboard } from '@/share/share-utils/clipboard-share-utils';
import type { VariantProps } from 'class-variance-authority';
import { Check, Copy, X } from 'lucide-react';
import type { ComponentProps } from 'react';
import { Button, buttonVariants } from '../button';

export interface CopyButtonProps
  extends Omit<ComponentProps<typeof Button>, 'onClick' | 'children'>,
    VariantProps<typeof buttonVariants> {
  /** 복사할 텍스트 */
  text: string;
  /** 기본 상태 라벨 */
  children?: React.ReactNode;
  /** 복사 성공 시 표시할 텍스트 */
  successText?: string;
  /** 복사 실패 시 표시할 텍스트 */
  errorText?: string;
  /** 복사 중 표시할 텍스트 */
  copyingText?: string;
  /** 아이콘 표시 여부 */
  showIcon?: boolean;
  /** 상태 복원 대기 시간 (ms) */
  resetDelay?: number;
  /** 복사 완료 후 콜백 */
  onCopyComplete?: (success: boolean) => void;
}

/**
 * 복사 기능이 내장된 버튼 컴포넌트
 *
 * @example
 * ```tsx
 * <CopyButton text="복사할 내용">복사</CopyButton>
 * <CopyButton text="URL" variant="outline" successText="링크 복사됨!">
 *   링크 복사
 * </CopyButton>
 * ```
 */
export function CopyButton({
  text,
  children = '복사',
  successText = '복사됨',
  errorText = '복사 실패',
  copyingText = '복사 중...',
  showIcon = true,
  resetDelay = 2000,
  onCopyComplete,
  disabled,
  ...buttonProps
}: CopyButtonProps) {
  const { copy, state } = useCopyToClipboard(resetDelay);

  const handleClick = async () => {
    const success = await copy(text);
    onCopyComplete?.(success);
  };

  const getIcon = () => {
    if (!showIcon) return null;

    switch (state) {
      case 'copied':
        return <Check size={16} />;
      case 'failed':
        return <X size={16} />;
      case 'copying':
      case 'idle':
      default:
        return <Copy size={16} />;
    }
  };

  const getLabel = () => {
    switch (state) {
      case 'copied':
        return successText;
      case 'failed':
        return errorText;
      case 'copying':
        return copyingText;
      case 'idle':
      default:
        return children;
    }
  };

  return (
    <Button
      onClick={handleClick}
      disabled={disabled || state === 'copying'}
      {...buttonProps}
    >
      {getIcon()}
      <span>{getLabel()}</span>
    </Button>
  );
}
