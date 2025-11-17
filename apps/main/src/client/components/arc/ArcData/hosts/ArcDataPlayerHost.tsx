'use client';

import * as React from 'react';

import { useDocumentDownloadUrl } from '@/client/states/queries/document/useDocument';

import { ArcDataPlayer } from '../components/core/ArcDataPlayer/ArcDataPlayer';
import { playerManager } from '../managers/ArcDataPlayerManager';

export interface ArcDataPlayerHostProps {
  documentId: string;
  mimeType?: string | null;
  storageKey?: string | null;
}

/**
 * ArcData 전용 Player 호스트
 * - 영상/오디오/YouTube 등 재생 가능한 파일에 대해
 *   documentId + fileMeta 정보를 기반으로 실제 재생 URL을 구성하고,
 *   ArcDataPlayer 뷰어를 렌더링합니다.
 */
export function ArcDataPlayerHost({
  documentId,
  mimeType,
  storageKey,
}: ArcDataPlayerHostProps): React.ReactElement | null {
  const isExternalUrl =
    typeof storageKey === 'string' &&
    (storageKey.startsWith('http://') || storageKey.startsWith('https://'));

  // R2에 저장된 파일인 경우에만 서명 URL을 발급
  const {
    data: download,
    isLoading: isDownloadLoading,
    error: downloadError,
  } = useDocumentDownloadUrl(documentId, {
    inline: true,
    enabled: !isExternalUrl,
  });

  const rawSrc = isExternalUrl ? storageKey ?? null : download?.url ?? null;

  const [mediaSrc, setMediaSrc] = React.useState<string | null>(null);
  const [mediaMimeType, setMediaMimeType] = React.useState<string | null>(
    mimeType ?? null,
  );
  const [loadError, setLoadError] = React.useState<unknown>(null);

  React.useEffect(() => {
    // 새로운 문서/URL 기준으로 상태 초기화
    setMediaSrc(null);
    setLoadError(null);

    if (!rawSrc) return;

    let cancelled = false;

    (async () => {
      try {
        const loaded = await playerManager.load(documentId, rawSrc, {
          mode: 'stream',
          mimeType: typeof mimeType === 'string' ? mimeType : undefined,
        });
        if (cancelled) return;

        setMediaSrc(loaded.src);
        setMediaMimeType(loaded.mimeType ?? (mimeType ?? null));
      } catch (error) {
        if (cancelled) return;
        setLoadError(error);
      }
    })();

    return () => {
      cancelled = true;
      playerManager.release(documentId);
    };
  }, [documentId, rawSrc, mimeType]);

  if (downloadError) {
    return null;
  }

  if (loadError) {
    return null;
  }

  const isReady =
    !!rawSrc &&
    !!mediaSrc &&
    (!isDownloadLoading || isExternalUrl);

  if (!isReady) {
    return null;
  }

  return (
    <div className="flex h-full w-full">
      <ArcDataPlayer
        src={mediaSrc}
        mimeType={mediaMimeType ?? mimeType}
        className="h-full w-full"
      />
    </div>
  );
}

export default ArcDataPlayerHost;


