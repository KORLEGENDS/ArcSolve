'use client';

import React from 'react';

import { PlateEditor } from './editor/plate-editor';

/**
 * ArcDataNote 코어 컴포넌트
 *
 * - ArcData 컨테이너/호스트에서 결정한 문서/노트 데이터를 기반으로
 *   노트 에디터 뷰를 렌더링하는 역할을 합니다.
 * - 현재는 데모용 PlateEditor를 그대로 감싸는 단순 래퍼이며,
 *   향후 props(초기 값, 읽기 전용 모드, 메타데이터 등)를 통해
 *   ArcWork/ArcData와 연동하도록 확장할 수 있습니다.
 */
export function ArcDataNote(): React.ReactElement {
  return (
    <div className="h-full w-full">
      <PlateEditor />
    </div>
  );
}

export default ArcDataNote;


