/**
 * ArcDataPlayer 트랜스크립트 인터랙션 훅
 * - 현재 스크립트 하이라이트
 * - 자동 스크롤 및 포커스 블러 상태 제어
 */

import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type {
    ArcDataPlayerScriptItem,
    ArcDataPlayerTranscriptOptions,
} from '../../components/core/ArcDataPlayer/ArcDataPlayer';

interface UsePlayerTranscriptParams {
  items: ArcDataPlayerScriptItem[];
  currentTime: number;
  duration: number | null;
  onSeekTo: (time: number) => void;
  options?: ArcDataPlayerTranscriptOptions;
}

interface UsePlayerTranscriptResult {
  activeScript: ArcDataPlayerScriptItem | null;
  isBlurred: boolean;
  effectiveDuration: number;
  activeItemRef: React.RefObject<HTMLDivElement | null>;
  handleScroll: () => void;
  handleScriptClick: (item: ArcDataPlayerScriptItem) => void;
  formatTime: (seconds: number) => string;
}

export const usePlayerTranscript = (
  params: UsePlayerTranscriptParams,
): UsePlayerTranscriptResult => {
  const { items, currentTime, duration, onSeekTo, options } = params;

  const [isBlurred, setIsBlurred] = useState(
    options?.initialFocusMode !== 'full',
  );
  const activeItemRef = useRef<HTMLDivElement | null>(null);
  const isAutoScrollingRef = useRef(false);

  const activeScript = useMemo(
    () =>
      items.find(
        (item) => currentTime >= item.start && currentTime < item.end,
      ) ?? null,
    [currentTime, items],
  );

  const effectiveDuration = useMemo(() => {
    if (typeof duration === 'number' && Number.isFinite(duration) && duration > 0) {
      return duration;
    }
    if (!items.length) return 0;
    const last = items[items.length - 1];
    return typeof last.end === 'number' && Number.isFinite(last.end)
      ? last.end
      : 0;
  }, [duration, items]);

  useEffect(() => {
    if (!activeScript || !activeItemRef.current) return;

    setIsBlurred(true);
    isAutoScrollingRef.current = true;

    activeItemRef.current.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });

    const timeoutId = window.setTimeout(() => {
      isAutoScrollingRef.current = false;
    }, 500);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [activeScript?.id]);

  const handleScroll = useCallback(() => {
    if (isAutoScrollingRef.current) return;
    setIsBlurred(false);
  }, []);

  const handleScriptClick = useCallback(
    (item: ArcDataPlayerScriptItem) => {
      onSeekTo(item.start);
      setIsBlurred(true);
    },
    [onSeekTo],
  );

  const formatTime = useCallback((seconds: number) => {
    if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  return {
    activeScript,
    isBlurred,
    effectiveDuration,
    activeItemRef,
    handleScroll,
    handleScriptClick,
    formatTime,
  };
};


