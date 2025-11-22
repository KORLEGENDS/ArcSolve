'use client';

import * as React from 'react';

import { useDocumentContent } from '@/client/states/queries/document/useDocument';
import type { EditorContent } from '@/share/schema/zod/document-note-zod';

import { isDrawContent, type DrawContent } from './types';

export interface UseDrawContentReturn {
  drawContent: DrawContent | null;
  rawContent: EditorContent | null;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
}

export function useDrawContent(documentId: string): UseDrawContentReturn {
  const { data, isLoading, isError, error } = useDocumentContent(documentId);
  const contents = data?.contents ?? null;

  const rawContent = React.useMemo(
    () => contents as EditorContent | null,
    [contents],
  );

  const drawContent = React.useMemo(
    () => (isDrawContent(rawContent) ? rawContent : null),
    [rawContent],
  );

  return {
    drawContent,
    rawContent,
    isLoading,
    isError,
    error,
  };
}

