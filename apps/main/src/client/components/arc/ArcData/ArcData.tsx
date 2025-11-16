'use client';

import * as React from 'react';

import { useDocumentFiles } from '@/client/states/queries/document/useDocument';
import { ArcDataPDFHost } from './hosts/ArcDataPDFHost';
import { ArcDataPlayerHost } from './hosts/ArcDataPlayerHost';

export interface ArcDataProps {
  /** ArcWork 탭 메타데이터에서 넘어오는 문서 ID (document.documentId) */
  documentId: string;
}

/**
 * ArcData 엔트리 컴포넌트
 * - documentId만 입력으로 받아, 어떤 호스트 컴포넌트로 렌더링할지만 결정합니다.
 * - document의 kind / fileMeta.mimeType / fileMeta.storageKey를 기반으로
 *   PDF / Player 등 적절한 호스트 컴포넌트를 선택합니다.
 */
export function ArcData({ documentId }: ArcDataProps): React.ReactElement | null {
  const {
    data: documents,
    isLoading: isListLoading,
    error: listError,
  } = useDocumentFiles();

  if (listError) {
    // eslint-disable-next-line no-console
    console.error('[ArcData] document list error', {
      documentId,
      listError,
    });
    return null;
  }

  if (isListLoading || !documents) {
    return null;
  }

  const document = documents.find((d) => d.documentId === documentId);
  if (!document || document.kind !== 'file') {
    return null;
  }

  const mimeType = document.fileMeta?.mimeType ?? null;
  const storageKey = document.fileMeta?.storageKey ?? null;

  const isPDF = mimeType === 'application/pdf';
  const isVideo =
    typeof mimeType === 'string' && mimeType.toLowerCase().startsWith('video/');
  const isAudio =
    typeof mimeType === 'string' && mimeType.toLowerCase().startsWith('audio/');

  const isExternalUrl =
    typeof storageKey === 'string' &&
    (storageKey.startsWith('http://') || storageKey.startsWith('https://'));

  const isYoutubeMime =
    typeof mimeType === 'string' &&
    mimeType.toLowerCase() === 'video/youtube';
  const isYoutubeUrl =
    isExternalUrl &&
    typeof storageKey === 'string' &&
    /(?:youtube\.com|youtu\.be)\//i.test(storageKey);

  const isPlayer = isVideo || isAudio || isYoutubeMime || isYoutubeUrl;

  if (isPDF) {
    return <ArcDataPDFHost documentId={documentId} />;
  }

  if (isPlayer) {
    return (
      <ArcDataPlayerHost
        documentId={documentId}
        mimeType={mimeType}
        storageKey={storageKey}
      />
    );
  }

  // TODO: 이미지 / 노트 등 다른 타입 호스트는 추후 확장
  return null;
}

export default ArcData;
