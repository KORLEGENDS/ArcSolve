'use client';

import { useArcWorkTabCreateAdapter } from '@/client/components/arc/ArcWork/adapters/useArcWorkTabCreateAdapter';
import { Button } from '@/client/components/ui/button';
import { queryKeyUtils } from '@/share/libs/react-query/query-keys';
import {
  aiQueryOptions,
  type DocumentDTO,
} from '@/share/libs/react-query/query-options';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { TabSetPlaceHolderCallback } from 'flexlayout-react';
import * as React from 'react';

export interface ArcWorkTabSetPlaceholderProps {
  /**
   * 탭셋 노드
   */
  node: Parameters<TabSetPlaceHolderCallback>[0];
}

interface ArcWorkPlaceholderContentProps {
  onStartAiSession: () => void;
}

function ArcWorkPlaceholderContent({ onStartAiSession }: ArcWorkPlaceholderContentProps) {
  return (
    <div className="flex h-full w-full items-center justify-center text-muted-foreground">
      <div className="flex flex-col items-center gap-3 text-center">
        <p className="text-sm">탭을 여기로 드래그하세요</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onStartAiSession}
        >
          AI 채팅 시작하기
        </Button>
      </div>
    </div>
  );
}

/**
 * 빈 탭셋 플레이스홀더 커스터마이징 컴포넌트
 * onTabSetPlaceHolder 콜백에서 사용됩니다
 */
export function ArcWorkTabSetPlaceholder({ node }: ArcWorkTabSetPlaceholderProps) {
  const { ensureOpenTab } = useArcWorkTabCreateAdapter();
  const queryClient = useQueryClient();
  const createAiSessionMutation = useMutation<DocumentDTO, unknown, { name: string; parentPath: string }>({
    mutationFn: (variables) =>
      aiQueryOptions.createSession.mutationFn({
        name: variables.name,
        parentPath: variables.parentPath,
      }),
  });

  const handleOpenArcAI = React.useCallback(async () => {
    try {
      const doc = await createAiSessionMutation.mutateAsync({
        name: '새 채팅',
        parentPath: '',
      });

      // AI 세션 생성 후 단일 Document 캐시를 패치합니다.
      queryKeyUtils.updateDocumentCache(queryClient, {
        action: 'add',
        document: doc,
      });

      ensureOpenTab({
        id: doc.documentId,
        name: doc.name,
        type: 'arcai-session',
      });
    } catch (error) {
      // 서버 에러는 일단 콘솔에만 기록합니다.
      // ArcAI 세션 생성 실패 시 탭을 열지 않습니다.
      // eslint-disable-next-line no-console
      console.error('[ArcWorkTabSetPlaceholder] AI 세션 문서 생성 실패:', error);
    }
  }, [createAiSessionMutation, ensureOpenTab, queryClient]);

  return <ArcWorkPlaceholderContent onStartAiSession={handleOpenArcAI} />;
}

/**
 * 탭 콘텐츠 용 기본 Placeholder 탭
 * - 헤더의 "새 탭" 버튼 등에서 사용할 수 있습니다.
 */
export function ArcWorkPlaceholderTab() {
  const { ensureOpenTab } = useArcWorkTabCreateAdapter();
  const queryClient = useQueryClient();
  const createAiSessionMutation = useMutation<DocumentDTO, unknown, { name: string; parentPath: string }>({
    mutationFn: (variables) =>
      aiQueryOptions.createSession.mutationFn({
        name: variables.name,
        parentPath: variables.parentPath,
      }),
  });

  const handleOpenArcAI = React.useCallback(async () => {
    try {
      const doc = await createAiSessionMutation.mutateAsync({
        name: '새 채팅',
        parentPath: '',
      });

      queryKeyUtils.updateDocumentCache(queryClient, {
        action: 'add',
        document: doc,
      });

      ensureOpenTab({
        id: doc.documentId,
        name: doc.name,
        type: 'arcai-session',
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('[ArcWorkPlaceholderTab] AI 세션 문서 생성 실패:', error);
    }
  }, [createAiSessionMutation, ensureOpenTab, queryClient]);

  return <ArcWorkPlaceholderContent onStartAiSession={handleOpenArcAI} />;
}

/**
 * 탭셋 플레이스홀더 콜백 생성 함수
 */
export function createTabSetPlaceholderCallback(
  customRenderer?: TabSetPlaceHolderCallback
): TabSetPlaceHolderCallback {
  return (node) => {
    // 커스텀 렌더러가 있으면 사용
    if (customRenderer) {
      return customRenderer(node);
    }

    // 기본 ArcWorkTabSetPlaceholder 렌더링
    return <ArcWorkTabSetPlaceholder node={node} />;
  };
}

