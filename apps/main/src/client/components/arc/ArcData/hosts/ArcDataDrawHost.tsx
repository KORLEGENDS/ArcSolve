'use client';

import * as React from 'react';

import type { EditorContent } from '@/share/schema/zod/document-note-zod';

import ArcDataDraw from '../components/core/ArcDataDraw/ArcDataDraw';
import { isDrawContent } from '../hooks/draw/types';
import { useDrawContent } from '../hooks/draw/useDrawContent';
import { useDocumentDrawSave } from '../hooks/draw/useDocumentDrawSave';

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
  const { drawContent, isLoading, isError } = useDrawContent(documentId);
  const { handleSceneChange } = useDocumentDrawSave({
    documentId,
    initialScene: drawContent,
  });

  const handleArcDataDrawChange = React.useCallback(
    (next: EditorContent) => {
      if (!isDrawContent(next)) return;
      handleSceneChange(next);
    },
    [handleSceneChange],
  );

  if (isError || isLoading) {
    return null;
  }

  return <ArcDataDraw value={drawContent} onChange={handleArcDataDrawChange} />;
}

export default ArcDataDrawHost;


