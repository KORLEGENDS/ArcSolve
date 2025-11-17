/**
 * ArcDataPlayer 재생 상태 컨트롤 훅
 * - currentTime / duration / isPlaying 공통 관리
 * - 외부 currentTime 제어(externalCurrentTime) 및 시킹 콜백(externalOnSeekTo) 연동
 * - ReactPlayer 인스턴스(ref) 기반 재생/일시정지/시킹 제어
 *
 * 스크립트 유무와 관계없이 항상 플레이어 상태를 관리하는 것을 목표로 합니다.
 */

import type React from 'react';
import { useCallback, useRef, useState } from 'react';

interface UsePlayerControllerParams {
  loop?: boolean;
  externalCurrentTime?: number;
  externalOnSeekTo?: (time: number) => void;
  onReady?: () => void;
}

interface UsePlayerControllerResult {
  playerRef: React.RefObject<any>;
  currentTime: number;
  duration: number | null;
  isPlaying: boolean;
  handleReady: (playerInstance: any) => void;
  handleTimeUpdate: (payload?: any) => void;
  handleDurationChange: (value?: any) => void;
  handlePlay: () => void;
  handlePause: () => void;
  handleEnded: () => void;
  handleSeekTo: (time: number) => void;
  handleTogglePlay: () => void;
}

export const usePlayerController = (
  params: UsePlayerControllerParams,
): UsePlayerControllerResult => {
  const { loop = false, externalCurrentTime, externalOnSeekTo, onReady } = params;

  const playerRef = useRef<any>(null);

  const [internalCurrentTime, setInternalCurrentTime] = useState(0);
  const [duration, setDuration] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const currentTime =
    typeof externalCurrentTime === 'number' && Number.isFinite(externalCurrentTime)
      ? externalCurrentTime
      : internalCurrentTime;

  const handleReady = useCallback(
    (playerInstance: any) => {
      if (playerInstance && !playerRef.current) {
        playerRef.current = playerInstance;
      }

      if (typeof onReady === 'function') {
        onReady();
      }
    },
    [onReady],
  );

  const handleTimeUpdate = useCallback(
    (payload?: any) => {
      let nextTime: number | null = null;

      if (payload && typeof payload.currentTime === 'number') {
        nextTime = payload.currentTime;
      } else if (payload && typeof payload.playedSeconds === 'number') {
        nextTime = payload.playedSeconds;
      } else {
        const player = playerRef.current;
        if (player) {
          if (typeof player.currentTime === 'number') {
            nextTime = player.currentTime;
          } else if (typeof player.getCurrentTime === 'function') {
            nextTime = player.getCurrentTime();
          }
        }
      }

      if (typeof nextTime === 'number' && !Number.isNaN(nextTime)) {
        // externalCurrentTime이 없을 때만 내부 상태 업데이트
        if (typeof externalCurrentTime !== 'number') {
          setInternalCurrentTime(nextTime);
        }
      }
    },
    [externalCurrentTime],
  );

  const handleDurationChange = useCallback((value?: any) => {
    if (typeof value === 'number' && Number.isFinite(value)) {
      setDuration(value);
    } else if (
      value &&
      typeof value.duration === 'number' &&
      Number.isFinite(value.duration)
    ) {
      setDuration(value.duration);
    }
  }, []);

  const handlePlay = useCallback(() => {
    setIsPlaying(true);
  }, []);

  const handlePause = useCallback(() => {
    setIsPlaying(false);
  }, []);

  const handleEnded = useCallback(() => {
    // 루프가 활성화되어 있으면 currentTime을 0으로 리셋
    if (loop) {
      // externalCurrentTime이 없을 때만 내부 상태 업데이트
      if (typeof externalCurrentTime !== 'number') {
        setInternalCurrentTime(0);
      }
      // 루프가 활성화되어 있으면 자동으로 재생이 다시 시작되므로
      // isPlaying은 true로 유지
    } else {
      setIsPlaying(false);
    }
  }, [loop, externalCurrentTime]);

  const handleSeekTo = useCallback(
    (time: number) => {
      const player = playerRef.current;
      if (!player || !Number.isFinite(time) || time < 0) return;

      try {
        if (typeof player.seekTo === 'function') {
          player.seekTo(time, 'seconds');
        } else if (typeof player.currentTime === 'number') {
          player.currentTime = time;
        }
      } catch {
        // seek 실패는 UI에 영향을 주지 않도록 조용히 무시
      }

      // externalCurrentTime이 있으면 외부 콜백 호출, 없으면 내부 상태 업데이트
      if (typeof externalCurrentTime === 'number') {
        // 외부에서 시간을 제어하는 경우, 외부 콜백을 통해 시간 업데이트 요청
        if (typeof externalOnSeekTo === 'function') {
          externalOnSeekTo(time);
        }
      } else {
        setInternalCurrentTime(time);
      }
    },
    [externalCurrentTime, externalOnSeekTo],
  );

  const handleTogglePlay = useCallback(() => {
    const player = playerRef.current;
    if (!player) return;

    try {
      if (isPlaying) {
        if (typeof player.pause === 'function') {
          player.pause();
        }
      } else if (typeof player.play === 'function') {
        const result = player.play();
        if (result && typeof result.catch === 'function') {
          result.catch(() => {
            // autoplay 실패 등은 무시
          });
        }
      }
    } catch {
      // 재생 제어 실패는 조용히 무시
    }
  }, [isPlaying]);

  return {
    playerRef,
    currentTime,
    duration,
    isPlaying,
    handleReady,
    handleTimeUpdate,
    handleDurationChange,
    handlePlay,
    handlePause,
    handleEnded,
    handleSeekTo,
    handleTogglePlay,
  };
};


