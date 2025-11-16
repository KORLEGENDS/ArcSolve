'use client';

import React from 'react';
import ReactPlayer from 'react-player';

import { cn } from '@/client/components/ui/utils';

const AnyReactPlayer = ReactPlayer as unknown as React.ComponentType<any>;

export interface ArcDataPlayerProps {
  src: string;
  mimeType?: string | null;
  title?: string;
  className?: string;
  zoom?: number; // 25~500 (width 비율로 사용)
  config?: Record<string, unknown>;
  onReady?: () => void;
  onError?: (error: unknown) => void;
}

export function ArcDataPlayer({
  src,
  mimeType,
  title,
  className,
  zoom = 100,
  config,
  onReady,
  onError,
}: ArcDataPlayerProps): React.ReactElement {
  const isAudio =
    typeof mimeType === 'string' && mimeType.toLowerCase().startsWith('audio/');

  const handleReadyInternal = () => {
    if (typeof onReady === 'function') {
      onReady();
    }
  };

  return (
    <div className={cn('h-full w-full min-h-0', className)}>
      <div className="relative h-full w-full overflow-hidden bg-black">
        <div
          style={{
            width: `${zoom}%`,
            maxWidth: '100%',
            margin: '0 auto',
            height: isAudio ? undefined : '100%',
          }}
        >
          <AnyReactPlayer
            src={src}
            width="100%"
            height={isAudio ? '64px' : '100%'}
            controls
            config={config}
            playsInline
            onReady={handleReadyInternal}
            onError={onError}
            title={title}
          />
        </div>
      </div>
    </div>
  );
}

export default ArcDataPlayer;
