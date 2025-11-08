'use client';

import { useCallback, useState } from 'react';

/**
 * 클립보드 유틸리티 함수
 */

/**
 * 텍스트를 클립보드에 복사
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      // 최신 Clipboard API 사용
      await navigator.clipboard.writeText(text);
      return true;
    } else {
      // 폴백: 구형 브라우저를 위한 execCommand 사용
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();

      try {
        const successful = document.execCommand('copy');
        textArea.remove();
        return successful;
      } catch {
        textArea.remove();
        return false;
      }
    }
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('클립보드 복사 실패:', error);
    }
    return false;
  }
}

/**
 * 클립보드 복사 상태
 */
export type CopyState = 'idle' | 'copying' | 'copied' | 'failed';

/**
 * 클립보드 복사 Hook
 *
 * @returns {object} copy 함수와 현재 상태
 *
 * @example
 * ```tsx
 * const { copy, state } = useCopyToClipboard();
 *
 * <button onClick={() => copy('복사할 텍스트')}>
 *   {state === 'copied' ? '복사됨!' : '복사'}
 * </button>
 * ```
 */
export function useCopyToClipboard(resetDelay = 2000) {
  const [state, setState] = useState<CopyState>('idle');

  const copy = useCallback(
    async (text: string) => {
      setState('copying');

      try {
        const success = await copyToClipboard(text);

        if (success) {
          setState('copied');
        } else {
          setState('failed');
        }

        // 지정된 시간 후 원래 상태로 복원
        setTimeout(() => {
          setState('idle');
        }, resetDelay);

        return success;
      } catch (error) {
        setState('failed');

        setTimeout(() => {
          setState('idle');
        }, resetDelay);

        return false;
      }
    },
    [resetDelay]
  );

  return { copy, state };
}
