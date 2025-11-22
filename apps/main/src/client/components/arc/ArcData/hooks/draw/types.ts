'use client';

import type { EditorContent } from '@/share/schema/zod/document-note-zod';

export type DrawContent = Extract<EditorContent, { type: 'draw' }>;

export const isDrawContent = (value: unknown): value is DrawContent => {
  return Boolean(
    value && typeof value === 'object' && (value as { type?: unknown }).type === 'draw',
  );
};

export const createEmptyDrawContent = (): DrawContent => ({
  type: 'draw',
  elements: [],
  appState: {},
  files: {},
});

