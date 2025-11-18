'use client';


import {
    ArrowUpToLineIcon,
    BaselineIcon,
    BoldIcon,
    Code2Icon,
    HighlighterIcon,
    ItalicIcon,
    PaintBucketIcon,
    StrikethroughIcon,
    UnderlineIcon,
    WandSparklesIcon,
} from 'lucide-react';
import { KEYS } from 'platejs';
import { useEditorReadOnly } from 'platejs/react';

import { ToolbarGroup } from '@/client/components/ui/toolbar';
import { AIToolbarButton } from '../button/ai-toolbar-button';
import { AlignToolbarButton } from '../button/align-toolbar-button';
import { CommentToolbarButton } from '../button/comment-toolbar-button';
import { EmojiToolbarButton } from '../button/emoji-toolbar-button';
import { ExportToolbarButton } from '../button/export-toolbar-button';
import { FontColorToolbarButton } from '../button/font-color-toolbar-button';
import { FontSizeToolbarButton } from '../button/font-size-toolbar-button';
import { RedoToolbarButton, UndoToolbarButton } from '../button/history-toolbar-button';
import { ImportToolbarButton } from '../button/import-toolbar-button';
import {
    IndentToolbarButton,
    OutdentToolbarButton,
} from '../button/indent-toolbar-button';
import { InsertToolbarButton } from '../button/insert-toolbar-button';
import { LineHeightToolbarButton } from '../button/line-height-toolbar-button';
import { LinkToolbarButton } from '../button/link-toolbar-button';
import {
    BulletedListToolbarButton,
    NumberedListToolbarButton,
    TodoListToolbarButton,
} from '../button/list-toolbar-button';
import { MarkToolbarButton } from '../button/mark-toolbar-button';
import { MediaToolbarButton } from '../button/media-toolbar-button';
import { ModeToolbarButton } from '../button/mode-toolbar-button';
import { MoreToolbarButton } from '../button/more-toolbar-button';
import { TableToolbarButton } from '../button/table-toolbar-button';
import { ToggleToolbarButton } from '../button/toggle-toolbar-button';
import { TurnIntoToolbarButton } from '../button/turn-into-toolbar-button';

export function FixedToolbarButtons() {
  const readOnly = useEditorReadOnly();

  return (
    <div className="flex w-full">
      {!readOnly && (
        <>
          <ToolbarGroup>
            <UndoToolbarButton />
            <RedoToolbarButton />
          </ToolbarGroup>

          <ToolbarGroup>
            <AIToolbarButton tooltip="AI commands">
              <WandSparklesIcon />
            </AIToolbarButton>
          </ToolbarGroup>

          <ToolbarGroup>
            <ExportToolbarButton>
              <ArrowUpToLineIcon />
            </ExportToolbarButton>

            <ImportToolbarButton />
          </ToolbarGroup>

          <ToolbarGroup>
            <InsertToolbarButton />
            <TurnIntoToolbarButton />
            <FontSizeToolbarButton />
          </ToolbarGroup>

          <ToolbarGroup>
            <MarkToolbarButton nodeType={KEYS.bold} tooltip="Bold (⌘+B)">
              <BoldIcon />
            </MarkToolbarButton>

            <MarkToolbarButton nodeType={KEYS.italic} tooltip="Italic (⌘+I)">
              <ItalicIcon />
            </MarkToolbarButton>

            <MarkToolbarButton
              nodeType={KEYS.underline}
              tooltip="Underline (⌘+U)"
            >
              <UnderlineIcon />
            </MarkToolbarButton>

            <MarkToolbarButton
              nodeType={KEYS.strikethrough}
              tooltip="Strikethrough (⌘+⇧+M)"
            >
              <StrikethroughIcon />
            </MarkToolbarButton>

            <MarkToolbarButton nodeType={KEYS.code} tooltip="Code (⌘+E)">
              <Code2Icon />
            </MarkToolbarButton>

            <FontColorToolbarButton nodeType={KEYS.color} tooltip="Text color">
              <BaselineIcon />
            </FontColorToolbarButton>

            <FontColorToolbarButton
              nodeType={KEYS.backgroundColor}
              tooltip="Background color"
            >
              <PaintBucketIcon />
            </FontColorToolbarButton>
          </ToolbarGroup>

          <ToolbarGroup>
            <AlignToolbarButton />

            <NumberedListToolbarButton />
            <BulletedListToolbarButton />
            <TodoListToolbarButton />
            <ToggleToolbarButton />
          </ToolbarGroup>

          <ToolbarGroup>
            <LinkToolbarButton />
            <TableToolbarButton />
            <EmojiToolbarButton />
          </ToolbarGroup>

          <ToolbarGroup>
            <MediaToolbarButton nodeType={KEYS.img} />
            <MediaToolbarButton nodeType={KEYS.video} />
            <MediaToolbarButton nodeType={KEYS.audio} />
            <MediaToolbarButton nodeType={KEYS.file} />
          </ToolbarGroup>

          <ToolbarGroup>
            <LineHeightToolbarButton />
            <OutdentToolbarButton />
            <IndentToolbarButton />
          </ToolbarGroup>

          <ToolbarGroup>
            <MoreToolbarButton />
          </ToolbarGroup>
        </>
      )}

      <div className="grow" />

      <ToolbarGroup>
        <MarkToolbarButton nodeType={KEYS.highlight} tooltip="Highlight">
          <HighlighterIcon />
        </MarkToolbarButton>
        <CommentToolbarButton />
      </ToolbarGroup>

      <ToolbarGroup>
        <ModeToolbarButton />
      </ToolbarGroup>
    </div>
  );
}
