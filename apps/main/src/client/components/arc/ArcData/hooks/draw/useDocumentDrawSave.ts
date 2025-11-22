'use client';

import * as React from 'react';

import { useDocumentSave, useSaveShortcut } from '../common/useDocumentSave';
import { useArcWorkTabStore } from '@/client/states/stores/arcwork-tab-store';
import type { DrawContent } from './types';

export interface UseDocumentDrawSaveOptions {
  documentId: string;
  initialScene: DrawContent | null;
}

export interface UseDocumentDrawSaveReturn {
  handleSceneChange: (next: DrawContent) => void;
  save: () => Promise<void>;
  isSaving: boolean;
  error: unknown;
}

export function useDocumentDrawSave({
  documentId,
  initialScene,
}: UseDocumentDrawSaveOptions): UseDocumentDrawSaveReturn {
  const { saveContent, updateCurrentHash, isSaving, error } =
    useDocumentSave<DrawContent>(documentId);
  const latestSceneRef = React.useRef<DrawContent | null>(initialScene);
  const clearTab = useArcWorkTabStore((state) => state.clearTab);

  React.useEffect(() => {
    latestSceneRef.current = initialScene;
    if (initialScene) {
      updateCurrentHash(initialScene);
    }
  }, [initialScene, updateCurrentHash]);

  const handleSceneChange = React.useCallback((next: DrawContent) => {
    latestSceneRef.current = next;
    updateCurrentHash(next);
  }, [updateCurrentHash]);

  const save = React.useCallback(async () => {
    if (!latestSceneRef.current) return;
    await saveContent(latestSceneRef.current);
  }, [saveContent]);

  useSaveShortcut(save);

  React.useEffect(
    () => () => {
      clearTab(documentId);
    },
    [clearTab, documentId],
  );

  return {
    handleSceneChange,
    save,
    isSaving,
    error,
  };
}

