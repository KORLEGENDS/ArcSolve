'use client';

import * as React from 'react';

import { type UseChatHelpers, useChat as useBaseChat } from '@ai-sdk/react';
import { AIChatPlugin, aiCommentToRange } from '@platejs/ai/react';
import { getCommentKey, getTransientCommentKey } from '@platejs/comment';
import { deserializeMd } from '@platejs/markdown';
import { BlockSelectionPlugin } from '@platejs/selection/react';
import { type UIMessage, DefaultChatTransport } from 'ai';
import { type TNode, KEYS, nanoid, NodeApi, TextApi } from 'platejs';
import { useEditorRef, usePluginOption } from 'platejs/react';

import { aiChatPlugin } from '@/client/components/arc/ArcData/components/core/ArcDataNote/editor/plugins/ai-kit';

import { discussionPlugin } from './plugins/discussion-kit';

export type ToolName = 'comment' | 'edit' | 'generate';

export type TComment = {
  comment: {
    blockId: string;
    comment: string;
    content: string;
  } | null;
  status: 'finished' | 'streaming';
};

export type MessageDataPart = {
  toolName: ToolName;
  comment?: TComment;
};

const isToolName = (value: unknown): value is ToolName =>
  value === 'comment' || value === 'edit' || value === 'generate';

const isTComment = (value: unknown): value is TComment =>
  !!value &&
  typeof value === 'object' &&
  'status' in value;

export type Chat = UseChatHelpers<ChatMessage>;

export type ChatMessage = UIMessage<{}, MessageDataPart>;

export const useChat = () => {
  const editor = useEditorRef();
  const options = usePluginOption(aiChatPlugin, 'chatOptions');

  const baseChat = useBaseChat<ChatMessage>({
    id: 'editor',
    transport: new DefaultChatTransport({
      api: options.api || '/api/ai/command',
      // NOTE:
      // - 기본 fetch 동작을 그대로 사용합니다.
      // - 서버 측 /api/ai/command 라우트에서 AI SDK 스트리밍 응답을 구현하면
      //   이 훅은 바로 연동될 수 있습니다.
    }),
    onData(rawEvent) {
      const event = rawEvent as { type: string; data?: unknown };

      if (event.type === 'data-toolName' && isToolName(event.data)) {
        editor.setOption(AIChatPlugin, 'toolName', event.data);
      }

      if (event.type === 'data-comment' && isTComment(event.data)) {
        const payload = event.data;

        if (payload.status === 'finished') {
          editor.getApi(AIChatPlugin).aiChat.hide();
          editor.getApi(BlockSelectionPlugin).blockSelection.deselect();

          return;
        }

        const aiComment = payload.comment!;
        const range = aiCommentToRange(editor, aiComment);

        if (!range) return console.warn('No range found for AI comment');

        const discussions =
          editor.getOption(discussionPlugin, 'discussions') || [];

        // Generate a new discussion ID
        const discussionId = nanoid();

        // Create a new comment
        const newComment = {
          id: nanoid(),
          contentRich: [{ children: [{ text: aiComment.comment }], type: 'p' }],
          createdAt: new Date(),
          discussionId,
          isEdited: false,
          userId: editor.getOption(discussionPlugin, 'currentUserId'),
        };

        // Create a new discussion
        const newDiscussion = {
          id: discussionId,
          comments: [newComment],
          createdAt: new Date(),
          documentContent: deserializeMd(editor, aiComment.content)
            .map((node: TNode) => NodeApi.string(node))
            .join('\n'),
          isResolved: false,
          userId: editor.getOption(discussionPlugin, 'currentUserId'),
        };

        // Update discussions
        const updatedDiscussions = [...discussions, newDiscussion];
        editor.setOption(discussionPlugin, 'discussions', updatedDiscussions);

        // Apply comment marks to the editor
        editor.tf.withMerging(() => {
          editor.tf.setNodes(
            {
              [getCommentKey(newDiscussion.id)]: true,
              [getTransientCommentKey()]: true,
              [KEYS.comment]: true,
            },
            {
              at: range,
              match: TextApi.isText,
              split: true,
            }
          );
        });
      }
    },

    ...options,
  });

  React.useEffect(() => {
    editor.setOption(AIChatPlugin, 'chat', baseChat as any);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseChat.status, baseChat.messages, baseChat.error]);

  return baseChat;
};

// NOTE:
// - 이 훅은 더 이상 클라이언트 측 더미 스트림을 사용하지 않습니다.
// - 서버의 /api/ai/command 라우트에서 AI SDK 스트림 응답을 구현해 연결하세요.
