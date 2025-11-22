'use client';

import * as React from 'react';

import { useDocumentDownloadUrl } from '@/client/states/queries/document/useDocument';

import { ArcDataImage } from '../components/core/ArcDataImage/ArcDataImage';

export interface ArcDataImageHostProps {
  documentId: string;
  mimeType?: string | null;
  storageKey?: string | null;
  name?: string | null;
}

/**
 * ArcData 전용 Image 호스트
 * - documentId 기준으로 이미지 다운로드 URL을 조회
 * - 외부 URL(storageKey)일 경우 바로 ArcDataImage에 전달
 * - ArcData 엔트리에서는 MIME만 판별하고 실제 렌더링은 이 컴포넌트가 담당
 */
export function ArcDataImageHost({
  documentId,
  mimeType,
  storageKey,
  name,
}: ArcDataImageHostProps): React.ReactElement | null {
  const isExternalUrl =
    typeof storageKey === 'string' &&
    (storageKey.startsWith('http://') || storageKey.startsWith('https://'));

  const {
    data: download,
    isLoading: isDownloadLoading,
    error: downloadError,
  } = useDocumentDownloadUrl(documentId, {
    inline: true,
    enabled: !isExternalUrl,
  });

  const imageSrc = isExternalUrl ? storageKey ?? null : download?.url ?? null;

  if (downloadError) {
    return null;
  }

  const isReady = !!imageSrc && (!isDownloadLoading || isExternalUrl);
  if (!isReady) {
    return null;
  }

  return (
    <div className="flex h-full w-full">
      <ArcDataImage
        src={imageSrc}
        mimeType={mimeType}
        name={name ?? undefined}
        isExternal={isExternalUrl}
      />
    </div>
  );
}

export default ArcDataImageHost;

