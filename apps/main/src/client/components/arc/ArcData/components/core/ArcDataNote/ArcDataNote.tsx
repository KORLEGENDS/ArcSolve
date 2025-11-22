'use client';

import dynamic from 'next/dynamic';
import React from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';

import type { EditorContent } from '@/share/schema/zod/document-note-zod';

import type { PlateEditorProps } from './editor/plate-editor';

const PlateEditor = dynamic<PlateEditorProps>(
  () => import('./editor/plate-editor').then((mod) => mod.PlateEditor),
  {
  ssr: false,
  },
);

/**
 * ArcDataNote 코어 컴포넌트
 *
 * - ArcData 컨테이너/호스트에서 결정한 문서/노트 데이터를 기반으로
 *   노트 에디터 뷰를 렌더링하는 역할을 합니다.
 * - Plate DnD는 ArcDataNote 루트 컨테이너(div)를 rootElement로 사용하는
 *   react-dnd HTML5 backend 위에서만 동작하도록 스코프를 제한합니다.
 */
export interface ArcDataNoteProps {
  /** 문서의 최신 Slate(JSON) 콘텐츠 */
  value?: EditorContent | null;
  /** 에디터 변경 시 상위 호스트가 처리할 수 있는 콜백 */
  onChange?: (next: EditorContent) => void;
}

export function ArcDataNote({ value, onChange }: ArcDataNoteProps): React.ReactElement {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [rootElement, setRootElement] = React.useState<HTMLElement | null>(null);

  React.useEffect(() => {
    if (containerRef.current && rootElement !== containerRef.current) {
      setRootElement(containerRef.current);
    }
  }, [rootElement]);

  return (
    <div ref={containerRef} className="h-full w-full">
      {rootElement && (
        <DndProvider backend={HTML5Backend} options={{ rootElement }}>
          <PlateEditor value={value} onChange={onChange} />
        </DndProvider>
      )}
    </div>
  );
}

export default ArcDataNote;


