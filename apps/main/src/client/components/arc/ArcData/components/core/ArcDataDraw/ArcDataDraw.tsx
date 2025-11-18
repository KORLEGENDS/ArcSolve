'use client';

import { Excalidraw, THEME } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import { useTheme } from 'next-themes';
import * as React from 'react';

import type { EditorContent } from '@/share/schema/zod/document-note-zod';

import styles from './ArcDataDraw.module.css';

type DrawContent = {
  type: 'draw';
  elements?: readonly any[];
  appState?: Record<string, any>;
  files?: Record<string, any>;
};

const isDrawContent = (value: unknown): value is DrawContent => {
  return !!value && typeof value === 'object' && (value as { type?: unknown }).type === 'draw';
};

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
  const excalidrawTheme = resolvedTheme === 'dark' ? THEME.DARK : THEME.LIGHT;

  const initialData = React.useMemo(() => {
    if (isDrawContent(value)) {
      return {
        elements: value.elements ?? [],
        appState: value.appState ?? {},
        files: value.files ?? {},
      };
    }

    // 기본: 빈 씬
    return {
      elements: [],
      appState: {},
      files: {},
    };
  }, [value]);

  const handleChange = React.useCallback(
    (elements: readonly any[], appState: any, files: Record<string, any>) => {
      if (!onChange) return;

      const next: DrawContent = {
        type: 'draw',
        elements,
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
            welcomeScreen: false,
          }}
        />
      </div>
    </div>
  );
}

export default ArcDataDraw;


