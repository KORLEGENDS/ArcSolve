'use client';

import { Pause, Play } from 'lucide-react';
import React from 'react';
import ReactPlayer from 'react-player';

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/client/components/ui/resizable';
import { cn } from '@/client/components/ui/utils';
import { usePlayerController } from '../../../hooks/player/usePlayerController';
import { usePlayerTranscript } from '../../../hooks/player/usePlayerTranscript';

const AnyReactPlayer = ReactPlayer as unknown as React.ComponentType<any>;

export interface ArcDataPlayerScriptItem {
  id: string;
  start: number;
  end: number;
  text: string;
  speaker?: string | null;
}

export interface ArcDataPlayerTranscriptOptions {
  /**
   * 초기 포커스 모드
   * - 'focus' (기본값): 현재 대본만 또렷하게, 나머지는 블러/감쇠
   * - 'full' : 모든 대본을 동일하게 표시
   */
  initialFocusMode?: 'focus' | 'full';
}

export interface ArcDataPlayerProps {
  src: string;
  mimeType?: string | null;
  title?: string;
  className?: string;
  zoom?: number; // 25~500 (width 비율로 사용)
  config?: Record<string, unknown>;
  loop?: boolean; // 루프 재생 여부
  playing?: boolean; // 재생 상태 제어
  currentTime?: number; // (옵션) 외부에서 currentTime을 제어할 때 사용 (데모/테스트용)
  onReady?: () => void;
  onError?: (error: unknown) => void;
  onSeekTo?: (time: number) => void; // (옵션) 대본 클릭 등으로 시킹할 때 호출되는 콜백

  /**
   * (옵션) 대본/스크립트 데이터
   * - start/end는 초 단위
   * - ArcData 상위 도메인(예: ArcWork)에서 전달
   */
  scriptItems?: ArcDataPlayerScriptItem[];
  transcriptOptions?: ArcDataPlayerTranscriptOptions;
}

export function ArcDataPlayer({
  src,
  mimeType,
  title,
  className,
  zoom = 100,
  config,
  loop = false,
  playing,
  currentTime: externalCurrentTime,
  onReady,
  onError,
  onSeekTo: externalOnSeekTo,
  scriptItems,
  transcriptOptions,
}: ArcDataPlayerProps): React.ReactElement {
  const isAudio =
    typeof mimeType === 'string' && mimeType.toLowerCase().startsWith('audio/');

  const hasScript =
    Array.isArray(scriptItems) && scriptItems.length > 0 && typeof src === 'string';

  const {
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
  } = usePlayerController({
    loop,
    externalCurrentTime,
    externalOnSeekTo,
    onReady,
  });

  const playerElement = (
    <div
      className={cn(
        'relative h-full w-full overflow-hidden bg-black',
      )}
    >
      <div
        style={{
          width: `${zoom}%`,
          maxWidth: '100%',
          margin: '0 auto',
          height: isAudio ? undefined : '100%',
        }}
      >
        <AnyReactPlayer
          ref={playerRef}
          src={src}
          width="100%"
          height={isAudio ? '64px' : '100%'}
          controls
          config={config}
          loop={loop}
          playing={playing}
          playsInline
          onReady={handleReady}
          onError={onError}
          title={title}
          onTimeUpdate={handleTimeUpdate}
          onDurationChange={handleDurationChange}
          onPlay={handlePlay}
          onPause={handlePause}
          onEnded={handleEnded}
        />
      </div>
    </div>
  );

  return (
    <div className={cn('h-full w-full min-h-0', className)}>
      {hasScript ? (
        <ResizablePanelGroup direction="vertical" className="h-full w-full">
          <ResizablePanel defaultSize={50} minSize={20} className="min-h-0">
            {playerElement}
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={50} minSize={20} className="min-h-0">
            <ArcDataPlayerTranscript
              items={scriptItems ?? []}
              currentTime={currentTime}
              duration={duration}
              isPlaying={isPlaying}
              onSeekTo={handleSeekTo}
              onTogglePlay={handleTogglePlay}
              options={transcriptOptions}
            />
          </ResizablePanel>
        </ResizablePanelGroup>
      ) : (
        playerElement
      )}
    </div>
  );
}

interface ArcDataPlayerTranscriptProps {
  items: ArcDataPlayerScriptItem[];
  currentTime: number;
  duration: number | null;
  isPlaying: boolean;
  onSeekTo: (time: number) => void;
  onTogglePlay: () => void;
  options?: ArcDataPlayerTranscriptOptions;
}

function ArcDataPlayerTranscript({
  items,
  currentTime,
  duration,
  isPlaying,
  onSeekTo,
  onTogglePlay,
  options,
}: ArcDataPlayerTranscriptProps): React.ReactElement | null {
  const {
    activeScript,
    isBlurred,
    effectiveDuration,
    activeItemRef,
    handleScroll,
    handleScriptClick,
    formatTime,
  } = usePlayerTranscript({
    items,
    currentTime,
    duration,
    onSeekTo,
    options,
  });

  if (!items.length) {
    return null;
  }

  const progressPercent =
    effectiveDuration > 0 ? (currentTime / effectiveDuration) * 100 : 0;

  return (
    <div className="flex h-full min-h-0 flex-col bg-linear-to-b from-zinc-950 to-black text-white">
      <div className="flex shrink-0 items-center justify-between border-b border-zinc-800 px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-white shadow-sm transition hover:bg-blue-500"
            onClick={onTogglePlay}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
          </button>
          <div className="font-mono text-sm">
            {formatTime(currentTime)}{' '}
            <span className="text-zinc-500">/ {formatTime(effectiveDuration)}</span>
          </div>
        </div>
        <div className="ml-4 flex-1">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full rounded-full bg-blue-500 transition-[width] duration-150"
              style={{ width: `${Math.max(0, Math.min(100, progressPercent))}%` }}
            />
          </div>
        </div>
      </div>

      <div
        className="flex-1 min-h-0 overflow-y-auto px-4 py-4"
        onScroll={handleScroll}
      >
        <div className="mx-auto flex max-w-3xl flex-col gap-3">
          {items.map((item) => {
            const isActive = activeScript?.id === item.id;

            return (
              <div
                key={item.id}
                ref={isActive ? activeItemRef : null}
                onClick={() => handleScriptClick(item)}
                className="cursor-pointer transition-all duration-300 ease-out"
                style={{
                  opacity: isBlurred ? (isActive ? 1 : 0.3) : 1,
                  filter: isBlurred
                    ? isActive
                      ? 'blur(0px)'
                      : 'blur(2px)'
                    : 'blur(0px)',
                  transform: isActive ? 'scale(1.02)' : 'scale(1)',
                }}
              >
                <div
                  className={cn(
                    'rounded-lg border px-4 py-3 transition-all duration-300',
                    isActive
                      ? 'border-blue-500 bg-blue-600/10 shadow-lg shadow-blue-500/20'
                      : 'border-zinc-700 bg-zinc-900/40',
                  )}
                >
                  <div className="mb-1 flex items-center justify-between text-xs text-zinc-500">
                    <span
                      className={cn(
                        'font-semibold',
                        isActive ? 'text-blue-400' : 'text-zinc-500',
                      )}
                    >
                      {item.speaker ?? 'Speaker'}
                    </span>
                    <span className="font-mono">
                      {formatTime(item.start)} - {formatTime(item.end)}
                    </span>
                  </div>
                  <p
                    className={cn(
                      'text-sm leading-relaxed',
                      isActive ? 'text-white' : 'text-zinc-300',
                    )}
                  >
                    {item.text}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default ArcDataPlayer;
