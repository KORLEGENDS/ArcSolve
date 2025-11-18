'use client';

import React from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';

import { PlateEditor } from './editor/plate-editor';

/**
 * ArcDataNote 코어 컴포넌트
 *
 * - ArcData 컨테이너/호스트에서 결정한 문서/노트 데이터를 기반으로
 *   노트 에디터 뷰를 렌더링하는 역할을 합니다.
 * - Plate DnD는 ArcDataNote 루트 컨테이너(div)를 rootElement로 사용하는
 *   react-dnd HTML5 backend 위에서만 동작하도록 스코프를 제한합니다.
 */
export function ArcDataNote(): React.ReactElement {
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
          <PlateEditor />
        </DndProvider>
      )}
    </div>
  );
}

export default ArcDataNote;


