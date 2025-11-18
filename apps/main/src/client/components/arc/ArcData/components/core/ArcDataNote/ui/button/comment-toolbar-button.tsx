'use client';


import { MessageSquareTextIcon } from 'lucide-react';
import { useEditorRef } from 'platejs/react';

import { commentPlugin } from '@/client/components/arc/ArcData/components/core/ArcDataNote/editor/plugins/comment-kit';

import { ToolbarButton } from '@/client/components/ui/toolbar';

export function CommentToolbarButton() {
  const editor = useEditorRef();

  return (
    <ToolbarButton
      onClick={() => {
        editor.getTransforms(commentPlugin).comment.setDraft();
      }}
      data-plate-prevent-overlay
      tooltip="Comment"
    >
      <MessageSquareTextIcon />
    </ToolbarButton>
  );
}
