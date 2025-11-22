'use client';

import * as React from 'react';

import { useMutation } from '@tanstack/react-query';

import { documentQueryOptions } from '@/share/libs/react-query/query-options';
import { useArcWorkTabStore } from '@/client/states/stores/arcwork-tab-store';
import { useArcWorkActiveTabId } from '@/client/states/stores/arcwork-store';

export interface UseDocumentSaveReturn<TContents = unknown> {
  saveContent: (contents: TContents) => Promise<void>;
  updateCurrentHash: (contents: TContents) => void;
  isSaving: boolean;
  error: unknown;
}

export function useDocumentSave<TContents = unknown>(
  documentId: string,
): UseDocumentSaveReturn<TContents> {
  const mutation = useMutation(documentQueryOptions.updateContent);
  const markSaved = useArcWorkTabStore((state) => state.markSaved);
  const setCurrentHash = useArcWorkTabStore((state) => state.setCurrentHash);
  const activeTabId = useArcWorkActiveTabId();

  const saveContent = React.useCallback(
    async (contents: TContents) => {
      // ArcWork 활성 탭이 존재하고, 현재 문서 탭이 아니면 저장하지 않음
      if (activeTabId && activeTabId !== documentId) {
        return;
      }
      const serialized = serializeContents(contents);
      await mutation.mutateAsync({
        documentId,
        contentId: null,
        contents,
        version: null,
        createdAt: null,
        updatedAt: null,
      });
      markSaved(documentId, serialized);
    },
    [activeTabId, documentId, markSaved, mutation],
  );

  const updateCurrentHash = React.useCallback(
    (contents: TContents) => {
      const serialized = serializeContents(contents);
      setCurrentHash(documentId, serialized);
    },
    [documentId, setCurrentHash],
  );

  return {
    saveContent,
    isSaving: mutation.isPending,
    error: mutation.error,
    updateCurrentHash,
  };
}

function serializeContents(contents: unknown): string | null {
  try {
    return JSON.stringify(contents);
  } catch {
    return null;
  }
}

export function useSaveShortcut(handler: () => Promise<void> | void): void {
  React.useEffect(() => {
    if (typeof window === 'undefined') return;

    const keydownHandler = (event: KeyboardEvent) => {
      const isSaveShortcut =
        (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's';
      if (!isSaveShortcut) return;

      event.preventDefault();
      void handler();
    };

    window.addEventListener('keydown', keydownHandler);
    return () => {
      window.removeEventListener('keydown', keydownHandler);
    };
  }, [handler]);
}

