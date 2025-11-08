import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

/**
 * 범용 진행률/전송 상태 스토어
 * - 파일 업로드 등 다양한 도메인에서 재사용 가능하도록 일반화된 구조
 * - itemId: string(도메인별 식별자; 예: temp:{uuid}, fileId, jobId 등)
 */

// ==================== 타입 정의 ====================

export type TransferStage =
  | 'idle'
  | 'requesting'
  | 'uploading'
  | 'confirming'
  | 'completed'
  | 'error';

export interface ProgressEntry {
  itemId: string;
  domain?: string; // 예: 'file', 'note', 'project'
  percentage: number; // 0~100 (단조 증가 보장 권장)
  stage: TransferStage;
  bytesLoaded?: number;
  bytesTotal?: number;
  updatedAt: number; // epoch ms
  error?: string;
}

export interface ProgressState {
  // itemId -> entry
  entries: Map<string, ProgressEntry>;
}

export interface ProgressActions {
  // 항목 생성/초기화
  upsert: (entry: Omit<ProgressEntry, 'updatedAt'> & { updatedAt?: number }) => void;
  // 진행률/스테이지 부분 업데이트(단조 증가 보장 옵션)
  update: (
    itemId: string,
    updates: Partial<Omit<ProgressEntry, 'itemId'>> & { monotonic?: boolean }
  ) => void;
  // 완료 처리(percentage=100/stage=completed)
  complete: (itemId: string) => void;
  // 실패 처리
  fail: (itemId: string, error?: string) => void;
  // 항목 제거
  remove: (itemId: string) => void;
  // 일괄 제거(도메인별)
  clearByDomain: (domain: string) => void;
  // 전체 초기화
  clearAll: () => void;
}

type ProgressStore = ProgressState & ProgressActions;

const initialState: ProgressState = {
  entries: new Map<string, ProgressEntry>(),
};

export const useProgressStore = create<ProgressStore>()(
  subscribeWithSelector((set, _get) => ({
    ...initialState,

    upsert: (entry) =>
      set((state) => {
        const now = typeof entry.updatedAt === 'number' ? entry.updatedAt : Date.now();
        const next = new Map(state.entries);
        next.set(entry.itemId, {
          ...entry,
          updatedAt: now,
        });
        return { entries: next };
      }),

    update: (itemId, updates) =>
      set((state) => {
        const prev = state.entries.get(itemId);
        if (!prev) return {} as ProgressState;
        const next = new Map(state.entries);
        let percentage = updates.percentage ?? prev.percentage;
        if (updates.monotonic) {
          percentage = Math.max(prev.percentage, percentage);
        }
        next.set(itemId, {
          ...prev,
          ...updates,
          percentage,
          updatedAt: Date.now(),
        });
        return { entries: next };
      }),

    complete: (itemId) =>
      set((state) => {
        const prev = state.entries.get(itemId);
        if (!prev) return {} as ProgressState;
        const next = new Map(state.entries);
        next.set(itemId, {
          ...prev,
          percentage: 100,
          stage: 'completed',
          updatedAt: Date.now(),
        });
        return { entries: next };
      }),

    fail: (itemId, error) =>
      set((state) => {
        const prev = state.entries.get(itemId);
        if (!prev) return {} as ProgressState;
        const next = new Map(state.entries);
        next.set(itemId, {
          ...prev,
          stage: 'error',
          error: error ?? prev.error,
          updatedAt: Date.now(),
        });
        return { entries: next };
      }),

    remove: (itemId) =>
      set((state) => {
        if (!state.entries.has(itemId)) return {} as ProgressState;
        const next = new Map(state.entries);
        next.delete(itemId);
        return { entries: next };
      }),

    clearByDomain: (domain) =>
      set((state) => {
        const next = new Map(state.entries);
        for (const [key, val] of next) {
          if (val.domain === domain) next.delete(key);
        }
        return { entries: next };
      }),

    clearAll: () => set(() => ({ entries: new Map<string, ProgressEntry>() })),
  }))
);

// ==================== 셀렉터 유틸 ====================

export const useProgressEntry = (itemId: string): ProgressEntry | undefined =>
  useProgressStore((s) => s.entries.get(itemId));

export const useProgressPercentage = (itemId: string): number =>
  useProgressStore((s) => s.entries.get(itemId)?.percentage ?? 0);

export const useProgressStage = (itemId: string): TransferStage =>
  useProgressStore((s) => s.entries.get(itemId)?.stage ?? 'idle');

export const useHasInProgressByDomain = (domain: string): boolean =>
  useProgressStore((s) => {
    for (const v of s.entries.values()) {
      if (v.domain === domain && v.stage !== 'completed' && v.stage !== 'error') return true;
    }
    return false;
  });


