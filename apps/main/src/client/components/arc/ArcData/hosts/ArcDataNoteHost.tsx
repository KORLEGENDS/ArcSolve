'use client';

import * as React from 'react';

import { useDocumentContent } from '@/client/states/queries/document/useDocument';
import type { EditorContent } from '@/share/schema/zod/document-note-zod';

import ArcDataNote from '../components/core/ArcDataNote/ArcDataNote';
import { useDocumentNoteSave } from '../hooks/note/useDocumentNoteSave';

export interface ArcDataNoteHostProps {
  /** ArcWork 탭 메타데이터에서 넘어오는 문서 ID (document.documentId) */
  documentId: string;
}

/**
 * ArcData 전용 Note 호스트
 *
 * - documentId 기준으로 노트 문서를 렌더링하는 진입점입니다.
 * - 현재는 ArcDataNote 데모 에디터를 감싸는 얇은 래퍼이며,
 *   향후 useDocumentContent(documentId) 및 noteContentSchema를 통해
 *   실제 문서 콘텐츠를 불러와 초기 값으로 전달하도록 확장할 수 있습니다.
 */
export function ArcDataNoteHost({
  documentId,
}: ArcDataNoteHostProps): React.ReactElement | null {
  const { data, isLoading, isError } = useDocumentContent(documentId);
  const contents = data?.contents ?? null;
  const noteContent: EditorContent | null = Array.isArray(contents)
    ? (contents as EditorContent)
    : null;

  const { handleContentChange } = useDocumentNoteSave({
    documentId,
    initialContent: noteContent,
  });

  if (isLoading || isError) {
    return null;
  }

  return <ArcDataNote value={noteContent} onChange={handleContentChange} />;
}

export default ArcDataNoteHost;


