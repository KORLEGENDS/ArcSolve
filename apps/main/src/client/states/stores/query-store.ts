import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

/**
 * 프로젝트 ID 상태 관리 스토어
 * 현재 선택된 프로젝트의 ID를 전역적으로 관리합니다.
 * 실제 데이터는 React Query를 통해 조회합니다.
 */

// ==================== 타입 정의 ====================

/**
 * 쿼리 ID 상태 인터페이스
 */
export interface QueryIdState {
  currentProjectId: string | null;
}

/**
 * 쿼리 ID 액션 인터페이스
 */
export interface QueryIdActions {
  // 프로젝트 ID 설정
  setCurrentProjectId: (projectId: string | null) => void;

  // 프로젝트 ID 초기화
  clearProjectId: () => void;
}

type QueryIdStore = QueryIdState & QueryIdActions;

// 초기 상태
const initialState: QueryIdState = {
  currentProjectId: null,
};

export const useQueryStore = create<QueryIdStore>()(
  subscribeWithSelector((set) => ({
    ...initialState,

    // Project ID 설정
    setCurrentProjectId: (projectId: string | null): void =>
      set(() => ({
        currentProjectId: projectId,
      })),

    // Project ID 초기화
    clearProjectId: (): void =>
      set(() => ({
        currentProjectId: null,
      })),
  }))
);

// ==================== 개별 셀렉터들 ====================

/**
 * Project ID 셀렉터들
 */
export const useCurrentProjectId = (): string | null =>
  useQueryStore((state) => state.currentProjectId);

export const useSetCurrentProjectId = (): ((
  projectId: string | null
) => void) => useQueryStore((state) => state.setCurrentProjectId);

/**
 * Project ID 초기화 셀렉터
 */
export const useClearProjectId = (): (() => void) =>
  useQueryStore((state) => state.clearProjectId);

// ==================== 유틸리티 셀렉터들 ====================

/**
 * 프로젝트가 선택되어 있는지 확인
 */
export const useHasSelectedProject = (): boolean => {
  return useQueryStore((state) => state.currentProjectId !== null);
};
