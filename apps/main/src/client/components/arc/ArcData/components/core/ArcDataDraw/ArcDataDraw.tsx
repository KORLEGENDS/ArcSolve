'use client';

import '@excalidraw/excalidraw/index.css';
import { useTheme } from 'next-themes';
import dynamic from 'next/dynamic';
import * as React from 'react';

import { isDrawContent, type DrawContent } from '@/client/components/arc/ArcData/hooks/draw/types';
import type { EditorContent } from '@/share/schema/zod/document-note-zod';

import styles from './ArcDataDraw.module.css';

const Excalidraw = dynamic<any>(
  () => import('@excalidraw/excalidraw').then((mod: any) => mod.Excalidraw),
  {
    ssr: false,
  },
);

export interface ArcDataDrawProps {
  /** Document 최신 contents (draw 씬 기대) */
  value: EditorContent | null | undefined;
  /** contents 변경 시 호출되는 콜백 */
  onChange?: (next: EditorContent) => void;
}

/**
 * ArcDataDraw 코어 컴포넌트
 *
 * - Excalidraw 캔버스를 렌더링하고, draw 씬을 EditorContent(JSON)로 변환합니다.
 * - 실제 로드/저장(HTTP 호출)은 호스트 컴포넌트(ArcDataDrawHost)에서 담당합니다.
 */
export function ArcDataDraw({ value, onChange }: ArcDataDrawProps): React.ReactElement {
  const { resolvedTheme } = useTheme();
  const excalidrawTheme: 'dark' | 'light' =
    resolvedTheme === 'dark' ? 'dark' : 'light';

  const initialData = React.useMemo(() => {
    if (isDrawContent(value)) {
      const elements = Array.isArray(value.elements) ? ([...value.elements] as any[]) : [];
      return {
        // 기존 저장된 appState/files 구조는 Excalidraw 내부 expectations와
        // 버전 차이가 있을 수 있으므로, 안정적으로 렌더링하기 위해
        // 우선 elements 정보만 전달합니다.
        elements,
      };
    }

    // 기본: 빈 씬
    return {
      elements: [],
    };
  }, [value]);

  const handleChange = React.useCallback(
    (elements: readonly any[], appState: any, files: Record<string, any>) => {
      if (!onChange) return;

      const normalizedElements = Array.isArray(elements) ? [...elements] : [];
      const next: DrawContent = {
        type: 'draw',
        elements: normalizedElements,
        appState,
        files: files ?? {},
      };

      onChange(next as EditorContent);
    },
    [onChange],
  );

  return (
    <div className={styles.editorContainer}>
      <div className={`${styles.editor} ${styles.excalidrawCustomScope}`}>
        <Excalidraw
          theme={excalidrawTheme}
          initialData={initialData}
          onChange={handleChange}
          langCode="ko-KR"
          UIOptions={{
            canvasActions: {
              saveToActiveFile: false,
              changeViewBackgroundColor: false,
              export: false,
              loadScene: false,
            },
            tools: {
              image: true,
            },
            welcomeScreen: false,
          }}
        />
      </div>
    </div>
  );
}

export default ArcDataDraw;


