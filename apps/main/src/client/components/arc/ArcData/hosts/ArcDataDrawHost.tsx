'use client';

import * as React from 'react';

import { useDocumentContent } from '@/client/states/queries/document/useDocument';
import type { EditorContent } from '@/share/schema/zod/document-note-zod';

import ArcDataDraw from '../components/core/ArcDataDraw/ArcDataDraw';

export interface ArcDataDrawHostProps {
  /** ArcWork 탭 메타데이터에서 넘어오는 문서 ID (document.documentId) */
  documentId: string;
}

/**
 * ArcData 전용 Draw 호스트
 *
 * - documentId 기준으로 노트(contents)를 조회하고,
 *   draw 씬을 ArcDataDraw에 전달합니다.
 * - onChange 시 문서 콘텐츠를 업데이트하여 버전 이력을 생성합니다.
 */
export function ArcDataDrawHost({
  documentId,
}: ArcDataDrawHostProps): React.ReactElement | null {
  const { data, isLoading, isError } = useDocumentContent(documentId);

  const contents = data?.contents ?? null;

  if (isError || isLoading) {
    return null;
  }

  const drawContent =
    contents && typeof contents === 'object' && (contents as any).type === 'draw'
      ? contents
      : null;

  // 현재 시점에서는 저장 로직을 분리하여, draw 콘텐츠는 읽기 전용으로만 렌더링합니다.
  // onChange 콜백을 전달하지 않으므로 Excalidraw 변경 사항은 서버에 전송되지 않습니다.
  return <ArcDataDraw value={drawContent as EditorContent | null} />;
}

export default ArcDataDrawHost;


