'use client';

import * as React from 'react';

import {
  useDocumentContent,
  useDocumentUpdate,
} from '@/client/states/queries/document/useDocument';
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
  const { updateDocument, isUpdating } = useDocumentUpdate();

  const contents = (data as { contents?: EditorContent | null } | undefined)?.contents ?? null;

  const saveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestContentRef = React.useRef<EditorContent | null>(contents);

  React.useEffect(() => {
    latestContentRef.current = contents;
  }, [contents]);

  const handleChange = React.useCallback(
    (next: EditorContent) => {
      latestContentRef.current = next;

      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }

      // 간단 디바운스 저장 (500ms)
      saveTimerRef.current = setTimeout(async () => {
        const payload = latestContentRef.current;
        if (!payload) return;

        await updateDocument({
          mode: 'content',
          documentId,
          contents: payload,
        });
      }, 500);
    },
    [documentId, updateDocument],
  );

  React.useEffect(
    () => () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    },
    [],
  );

  if (isError || isLoading) {
    return null;
  }

  const drawContent =
    contents && typeof contents === 'object' && (contents as any).type === 'draw'
      ? contents
      : null;

  return <ArcDataDraw value={drawContent as EditorContent | null} onChange={handleChange} />;
}

export default ArcDataDrawHost;


