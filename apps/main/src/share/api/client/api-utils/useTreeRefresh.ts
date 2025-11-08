'use client';

import { getParentPath, reduceToTopLevelPaths } from '@/share/share-utils/path-share-utils';
import { useCallback } from 'react';


export interface TreeRefreshApi {
  refetchPath: (path: string) => Promise<void>;
}

export interface UseTreeRefreshReturn {
  /**
   * 경로 집합을 중복 제거 후 병렬로 리페치합니다.
   */
  refreshPaths: (paths: Array<string | undefined | null>) => Promise<void>;

  /**
   * 생성 이후 부모 경로 1건을 리페치합니다.
   */
  afterCreate: (parentPath: string | undefined | null) => Promise<void>;

  /**
   * 삭제 이후 선택 항목들의 부모 경로를 수합하여 리페치합니다.
   * items는 path 필드를 가질 수 있는 임의 객체 배열입니다.
   */
  afterDeleteFromItems: (items: Array<{ path?: string | null }>) => Promise<void>;

  /**
   * 이미 부모 경로들을 알고 있는 경우 직접 전달하여 리페치합니다.
   */
  afterDeleteByParentPaths: (parentPaths: Array<string | undefined | null>) => Promise<void>;
}

/**
 * 트리 리페치 정책 공용 훅
 * - 노트/파일 공통: 경로 기반 리페치 규칙을 단일화
 * - 루트/서브트리 구분 로직은 `refetchPath` 구현에 위임
 */
export function useTreeRefresh(api: TreeRefreshApi, _opts?: Record<string, never>): UseTreeRefreshReturn {
  const refreshPaths = useCallback(async (paths: Array<string | undefined | null>): Promise<void> => {
    const unique = Array.from(
      new Set(
        (paths ?? [])
          .map((p) => (p && p.trim().length > 0 ? p : '/'))
      )
    );
    if (unique.length === 0) return;
    // 상위 경로만 남기고 하위 중복 제거 (불필요한 서브트리 중복 로딩 방지)
    const topOnly = reduceToTopLevelPaths(unique as string[]);
    await Promise.all(topOnly.map((p) => api.refetchPath(p || '/')));
  }, [api]);

  const afterCreate = useCallback(async (parentPath: string | undefined | null): Promise<void> => {
    const p = (parentPath && parentPath.trim().length > 0) ? parentPath : '/';
    await refreshPaths([p]);
  }, [refreshPaths]);

  const afterDeleteFromItems = useCallback(async (items: Array<{ path?: string | null }>): Promise<void> => {
    const parents = new Set<string>();
    for (const it of items ?? []) {
      const path = (it?.path ?? '') as string;
      if (typeof path === 'string' && path.length > 0) {
        parents.add(getParentPath(path));
      }
    }
    await refreshPaths(Array.from(parents));
  }, [refreshPaths]);

  const afterDeleteByParentPaths = useCallback(async (parentPaths: Array<string | undefined | null>): Promise<void> => {
    await refreshPaths(parentPaths);
  }, [refreshPaths]);

  return { refreshPaths, afterCreate, afterDeleteFromItems, afterDeleteByParentPaths };
}

export default useTreeRefresh;


