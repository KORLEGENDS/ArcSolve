'use client';

import * as React from 'react';

import { useDocumentDetail } from '@/client/states/queries/document/useDocument';
import { ArcDataNoteHost } from './hosts/ArcDataNoteHost';
import { ArcDataPDFHost } from './hosts/ArcDataPDFHost';
import { ArcDataPlayerHost } from './hosts/ArcDataPlayerHost';
import { ArcDataDrawHost } from './hosts/ArcDataDrawHost';
import { ArcDataImageHost } from './hosts/ArcDataImageHost';

export interface ArcDataProps {
  /** ArcWork 탭 메타데이터에서 넘어오는 문서 ID (document.documentId) */
  documentId: string;
}

/**
 * ArcData 엔트리 컴포넌트
 * - documentId만 입력으로 받아, 어떤 호스트 컴포넌트로 렌더링할지만 결정합니다.
 * - 구조(kind)는 'folder' | 'document'로만 사용하고,
 *   실제 타입(NOTE/DRAW/PDF/PLAYER 등)은 mimeType / storageKey 기반으로 분기합니다.
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

  // 폴더는 ArcData에서 직접 렌더링하지 않습니다.
  if (document.kind === 'folder') {
    return null;
  }

  const mimeType = document.mimeType ?? null;
  const storageKey = document.storageKey ?? null;
  const documentName = document.name ?? null;

  const isPDF = mimeType === 'application/pdf';
  const isVideo =
    typeof mimeType === 'string' && mimeType.toLowerCase().startsWith('video/');
  const isAudio =
    typeof mimeType === 'string' && mimeType.toLowerCase().startsWith('audio/');
  const isImage =
    typeof mimeType === 'string' && mimeType.toLowerCase().startsWith('image/');

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

  // 노트 MIME 타입 (Plate / Draw)
  const isNoteMime =
    typeof mimeType === 'string' &&
    mimeType.startsWith('application/vnd.arc.note+');
  const isDrawNote =
    mimeType === 'application/vnd.arc.note+draw';

  if (isNoteMime) {
    if (isDrawNote) {
      return <ArcDataDrawHost documentId={documentId} />;
    }
    return <ArcDataNoteHost documentId={documentId} />;
  }

  if (isImage) {
    return (
      <ArcDataImageHost
        documentId={documentId}
        mimeType={mimeType}
        storageKey={storageKey}
        name={documentName}
      />
    );
  }

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

  // TODO: 기타 특수 MIME 타입은 추후 확장
  return null;
}

export default ArcData;
