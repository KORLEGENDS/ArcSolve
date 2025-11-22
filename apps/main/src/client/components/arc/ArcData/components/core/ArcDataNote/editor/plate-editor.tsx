'use client';


import * as React from 'react';

import { normalizeNodeId, type Value } from 'platejs';
import { Plate, usePlateEditor } from 'platejs/react';

import { EditorKit } from '@/client/components/arc/ArcData/components/core/ArcDataNote/editor/editor-kit';
import { SettingsDialog } from '@/client/components/arc/ArcData/components/core/ArcDataNote/editor/settings-dialog';
import { DEFAULT_NOTE_PARAGRAPH, type EditorContent } from '@/share/schema/zod/document-note-zod';

import { Editor, EditorContainer } from '../ui/editor';

export interface PlateEditorProps {
  value?: EditorContent | null;
  onChange?: (next: EditorContent) => void;
}

const isSlateContent = (
  content: EditorContent | null | undefined,
): content is Value => Array.isArray(content);

const createNormalizedValue = (content: EditorContent | null | undefined): Value => {
  if (isSlateContent(content)) {
    return normalizeNodeId(content as Value);
  }

  return normalizeNodeId(DEFAULT_NOTE_PARAGRAPH as Value);
};

export function PlateEditor({ value, onChange }: PlateEditorProps) {
  const onChangeRef = React.useRef(onChange);

  React.useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const plateValue = React.useMemo(() => createNormalizedValue(value ?? undefined), [value]);

  const editor = usePlateEditor(
    {
    plugins: EditorKit,
      value: plateValue,
    },
    [plateValue],
  );

  const handlePlateChange = React.useCallback(
    ({ value: nextValue }: { value: Value }) => {
      onChangeRef.current?.(nextValue as EditorContent);
    },
    [],
  );

  return (
    <Plate editor={editor} onChange={handlePlateChange}>
      <EditorContainer>
        <Editor variant="demo" />
      </EditorContainer>

      <SettingsDialog />
    </Plate>
  );
}
