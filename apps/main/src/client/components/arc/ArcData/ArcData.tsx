'use client';

import * as React from 'react';

import { useDocumentDetail } from '@/client/states/queries/document/useDocument';
import { ArcDataNoteHost } from './hosts/ArcDataNoteHost';
import { ArcDataPDFHost } from './hosts/ArcDataPDFHost';
import { ArcDataPlayerHost } from './hosts/ArcDataPlayerHost';
import { ArcDataDrawHost } from './hosts/ArcDataDrawHost';

export interface ArcDataProps {
  /** ArcWork 탭 메타데이터에서 넘어오는 문서 ID (document.documentId) */
  documentId: string;
}

/**
 * ArcData 엔트리 컴포넌트
 * - documentId만 입력으로 받아, 어떤 호스트 컴포넌트로 렌더링할지만 결정합니다.
 * - document의 kind / mimeType / storageKey를 기반으로
 *   PDF / Player / Note / Draw 등 적절한 호스트 컴포넌트를 선택합니다.
 */
export function ArcData({ documentId }: ArcDataProps): React.ReactElement | null {
  const {
    data: document,
    isLoading,
    isError,
  } = useDocumentDetail(documentId);

  if (isError || isLoading || !document) {
    return null;
  }

  if (document.kind === 'note') {
    // mimeType으로 노트 타입 구분
    const mimeType = document.mimeType;
    const isDraw = mimeType === 'application/vnd.arc.note+draw';
    
    if (isDraw) {
      return <ArcDataDrawHost documentId={documentId} />;
    }
    
    return <ArcDataNoteHost documentId={documentId} />;
  }

  if (document.kind !== 'file') {
    return null;
  }

  const mimeType = document.mimeType ?? null;
  const storageKey = document.storageKey ?? null;

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
