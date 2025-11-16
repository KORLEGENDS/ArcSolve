'use client';

import * as React from 'react';

import { useDocumentDownloadUrl } from '@/client/states/queries/document/useDocument';

import { ArcDataPlayer } from '../components/core/ArcDataPlayer/ArcDataPlayer';

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

  const src = isExternalUrl ? storageKey ?? null : download?.url ?? null;

  if (downloadError) {
    // eslint-disable-next-line no-console
    console.error('[ArcDataPlayerHost] download url error', {
      documentId,
      mimeType,
      storageKey,
      downloadError:
        downloadError instanceof Error
          ? {
              name: downloadError.name,
              message: downloadError.message,
              stack: downloadError.stack,
            }
          : downloadError,
    });
    return null;
  }

  const isReady = !!src && (!isDownloadLoading || isExternalUrl);
  if (!isReady) {
    return null;
  }

  return (
    <div className="flex h-full w-full">
      <ArcDataPlayer
        src={src}
        mimeType={mimeType}
        className="h-full w-full"
      />
    </div>
  );
}

export default ArcDataPlayerHost;


