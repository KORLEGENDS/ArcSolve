'use client';

import { type Value, TrailingBlockPlugin } from 'platejs';
import { type TPlateEditor, useEditorRef } from 'platejs/react';

import { AIKit } from '@/client/components/arc/ArcData/components/core/ArcDataNote/editor/plugins/ai-kit';
import { AlignKit } from '@/client/components/arc/ArcData/components/core/ArcDataNote/editor/plugins/align-kit';
import { AutoformatKit } from '@/client/components/arc/ArcData/components/core/ArcDataNote/editor/plugins/autoformat-kit';
import { BasicBlocksKit } from '@/client/components/arc/ArcData/components/core/ArcDataNote/editor/plugins/basic-blocks-kit';
import { BasicMarksKit } from '@/client/components/arc/ArcData/components/core/ArcDataNote/editor/plugins/basic-marks-kit';
import { BlockMenuKit } from '@/client/components/arc/ArcData/components/core/ArcDataNote/editor/plugins/block-menu-kit';
import { BlockPlaceholderKit } from '@/client/components/arc/ArcData/components/core/ArcDataNote/editor/plugins/block-placeholder-kit';
import { CalloutKit } from '@/client/components/arc/ArcData/components/core/ArcDataNote/editor/plugins/callout-kit';
import { CodeBlockKit } from '@/client/components/arc/ArcData/components/core/ArcDataNote/editor/plugins/code-block-kit';
import { ColumnKit } from '@/client/components/arc/ArcData/components/core/ArcDataNote/editor/plugins/column-kit';
import { CommentKit } from '@/client/components/arc/ArcData/components/core/ArcDataNote/editor/plugins/comment-kit';
import { CopilotKit } from '@/client/components/arc/ArcData/components/core/ArcDataNote/editor/plugins/copilot-kit';
import { CursorOverlayKit } from '@/client/components/arc/ArcData/components/core/ArcDataNote/editor/plugins/cursor-overlay-kit';
import { DateKit } from '@/client/components/arc/ArcData/components/core/ArcDataNote/editor/plugins/date-kit';
import { DiscussionKit } from '@/client/components/arc/ArcData/components/core/ArcDataNote/editor/plugins/discussion-kit';
import { DndKit } from '@/client/components/arc/ArcData/components/core/ArcDataNote/editor/plugins/dnd-kit';
import { DocxKit } from '@/client/components/arc/ArcData/components/core/ArcDataNote/editor/plugins/docx-kit';
import { EmojiKit } from '@/client/components/arc/ArcData/components/core/ArcDataNote/editor/plugins/emoji-kit';
import { ExitBreakKit } from '@/client/components/arc/ArcData/components/core/ArcDataNote/editor/plugins/exit-break-kit';
import { FixedToolbarKit } from '@/client/components/arc/ArcData/components/core/ArcDataNote/editor/plugins/fixed-toolbar-kit';
import { FloatingToolbarKit } from '@/client/components/arc/ArcData/components/core/ArcDataNote/editor/plugins/floating-toolbar-kit';
import { FontKit } from '@/client/components/arc/ArcData/components/core/ArcDataNote/editor/plugins/font-kit';
import { LineHeightKit } from '@/client/components/arc/ArcData/components/core/ArcDataNote/editor/plugins/line-height-kit';
import { LinkKit } from '@/client/components/arc/ArcData/components/core/ArcDataNote/editor/plugins/link-kit';
import { ListKit } from '@/client/components/arc/ArcData/components/core/ArcDataNote/editor/plugins/list-kit';
import { MarkdownKit } from '@/client/components/arc/ArcData/components/core/ArcDataNote/editor/plugins/markdown-kit';
import { MathKit } from '@/client/components/arc/ArcData/components/core/ArcDataNote/editor/plugins/math-kit';
import { MediaKit } from '@/client/components/arc/ArcData/components/core/ArcDataNote/editor/plugins/media-kit';
import { MentionKit } from '@/client/components/arc/ArcData/components/core/ArcDataNote/editor/plugins/mention-kit';
import { SlashKit } from '@/client/components/arc/ArcData/components/core/ArcDataNote/editor/plugins/slash-kit';
import { SuggestionKit } from '@/client/components/arc/ArcData/components/core/ArcDataNote/editor/plugins/suggestion-kit';
import { TableKit } from '@/client/components/arc/ArcData/components/core/ArcDataNote/editor/plugins/table-kit';
import { TocKit } from '@/client/components/arc/ArcData/components/core/ArcDataNote/editor/plugins/toc-kit';
import { ToggleKit } from '@/client/components/arc/ArcData/components/core/ArcDataNote/editor/plugins/toggle-kit';

export const EditorKit = [
  ...CopilotKit,
  ...AIKit,

  // Elements
  ...BasicBlocksKit,
  ...CodeBlockKit,
  ...TableKit,
  ...ToggleKit,
  ...TocKit,
  ...MediaKit,
  ...CalloutKit,
  ...ColumnKit,
  ...MathKit,
  ...DateKit,
  ...LinkKit,
  ...MentionKit,

  // Marks
  ...BasicMarksKit,
  ...FontKit,

  // Block Style
  ...ListKit,
  ...AlignKit,
  ...LineHeightKit,

  // Collaboration
  ...DiscussionKit,
  ...CommentKit,
  ...SuggestionKit,

  // Editing
  ...SlashKit,
  ...AutoformatKit,
  ...CursorOverlayKit,
  ...BlockMenuKit,
  ...DndKit,
  ...EmojiKit,
  ...ExitBreakKit,
  TrailingBlockPlugin,

  // Parsers
  ...DocxKit,
  ...MarkdownKit,

  // UI
  ...BlockPlaceholderKit,
  ...FixedToolbarKit,
  ...FloatingToolbarKit,
];

export type MyEditor = TPlateEditor<Value, (typeof EditorKit)[number]>;

export const useEditor = () => useEditorRef<MyEditor>();
