'use client';

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

type TabDirtyState = {
  hash: string | null;
  originalHash: string | null;
  isDirty: boolean;
};

interface ArcWorkTabStoreState {
  tabs: Record<string, TabDirtyState>;
  setCurrentHash: (tabId: string, hash: string | null) => void;
  markSaved: (tabId: string, hash: string | null) => void;
  clearTab: (tabId: string) => void;
}

export const useArcWorkTabStore = create<ArcWorkTabStoreState>()(
  subscribeWithSelector((set) => ({
    tabs: {},

    setCurrentHash: (tabId, hash) =>
      set((state) => {
        const prev = state.tabs[tabId] ?? { hash: null, originalHash: null, isDirty: false };
        const originalHash = prev.originalHash ?? hash;
        const isDirty = !!hash && hash !== originalHash;
        return {
          tabs: {
            ...state.tabs,
            [tabId]: {
              hash,
              originalHash,
              isDirty,
            },
          },
        };
      }),

    markSaved: (tabId, hash) =>
      set((state) => ({
        tabs: {
          ...state.tabs,
          [tabId]: {
            hash,
            originalHash: hash,
            isDirty: false,
          },
        },
      })),

    clearTab: (tabId) =>
      set((state) => {
        const next = { ...state.tabs };
        delete next[tabId];
        return { tabs: next };
      }),
  })),
);

export const useArcWorkTabDirty = (tabId: string): boolean =>
  useArcWorkTabStore((state) => state.tabs[tabId]?.isDirty ?? false);

