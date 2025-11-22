'use client';

import * as React from 'react';

import type { EditorContent } from '@/share/schema/zod/document-note-zod';

import { useArcWorkTabStore } from '@/client/states/stores/arcwork-tab-store';
import { useDocumentSave, useSaveShortcut } from '../common/useDocumentSave';

export interface UseDocumentNoteSaveOptions {
  documentId: string;
  initialContent: EditorContent | null;
}

export interface UseDocumentNoteSaveReturn {
  handleContentChange: (next: EditorContent) => void;
  save: () => Promise<void>;
  isSaving: boolean;
  error: unknown;
}

export function useDocumentNoteSave({
  documentId,
  initialContent,
}: UseDocumentNoteSaveOptions): UseDocumentNoteSaveReturn {
  const { saveContent, updateCurrentHash, isSaving, error } =
    useDocumentSave<EditorContent>(documentId);
  const latestContentRef = React.useRef<EditorContent | null>(initialContent);
  const clearTab = useArcWorkTabStore((state) => state.clearTab);

  React.useEffect(() => {
    latestContentRef.current = initialContent;
    if (initialContent) {
      updateCurrentHash(initialContent);
    }
  }, [initialContent, updateCurrentHash]);

  const handleContentChange = React.useCallback((next: EditorContent) => {
    latestContentRef.current = next;
    updateCurrentHash(next);
  }, [updateCurrentHash]);

  const save = React.useCallback(async () => {
    if (!latestContentRef.current) return;
    await saveContent(latestContentRef.current);
  }, [saveContent]);

  useSaveShortcut(save);

  React.useEffect(
    () => () => {
      clearTab(documentId);
    },
    [clearTab, documentId],
  );

  return {
    handleContentChange,
    save,
    isSaving,
    error,
  };
}

