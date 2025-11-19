'use client';


import { normalizeNodeId } from 'platejs';
import { Plate, usePlateEditor } from 'platejs/react';

import { EditorKit } from '@/client/components/arc/ArcData/components/core/ArcDataNote/editor/editor-kit';
import { SettingsDialog } from '@/client/components/arc/ArcData/components/core/ArcDataNote/editor/settings-dialog';
import { Editor, EditorContainer } from '../ui/editor';

export function PlateEditor() {
  const editor = usePlateEditor({
    plugins: EditorKit,
    value,
  });

  return (
    <Plate editor={editor}>
      <EditorContainer>
        <Editor variant="demo" />
      </EditorContainer>

      <SettingsDialog />
    </Plate>
  );
}

const value = normalizeNodeId([
  {
    children: [{ text: 'Welcome to the Plate Playground!' }],
    type: 'h1',
  }
]);
