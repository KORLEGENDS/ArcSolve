import type { Layout as FlexLayoutView, IJsonModel, TabSetNode, TabNode } from 'flexlayout-react';
import { Actions, DockLocation, Model } from 'flexlayout-react';
import type React from 'react';
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

/**
 * ArcWork 레이아웃 저장/복원 전용 스토어 (MVP)
 * - Model 직렬화/복원(LocalStorage 기반)
 * - ArcWork 통합 시 onModelChange/onAction에서 saveLayout 호출을 권장(디바운스는 호출 측에서)
 */

// ==================== 타입 정의 ====================

export interface ServiceLayoutState {
  model: Model | null;
  lastSavedLayout: IJsonModel | null;
  storageKey: string;
  layoutRef: FlexLayoutView | null;
}

export interface ServiceOpenTabInput {
  id: string;
  type: string; // component key
  name?: string;
  content?: unknown;
  tabsetId?: string;
}

export interface ServiceLayoutActions {
  setModel: (model: Model | null) => void;
  setStorageKey: (key: string) => void;
  setLayoutRef: (layout: FlexLayoutView | null) => void;

  saveLayout: (options?: { key?: string }) => void;
  restoreLayout: (options?: { key?: string; fallback?: IJsonModel; replace?: boolean }) => Model | null;
  clearSavedLayout: (options?: { key?: string }) => void;

  // Tabs API
  open: (input: ServiceOpenTabInput) => boolean;
  activate: (id: string) => boolean;
  close: (id: string) => boolean;
  ensureOpen: (input: ServiceOpenTabInput) => boolean;

  // DnD helpers
  makeExternalDragHandler: () => ((event: React.DragEvent<HTMLElement>) => undefined | { json: any; onDrop?: (node?: unknown, event?: React.DragEvent<HTMLElement>) => void });
  startAddTabDrag: (
    event: React.DragEvent<HTMLElement>,
    input: ServiceOpenTabInput,
    options?: { dragImage?: React.ReactNode; imageOffset?: { x: number; y: number } }
  ) => boolean;
}

type ServiceLayoutStore = ServiceLayoutState & ServiceLayoutActions;

// ==================== 내부 유틸 ====================

const DEFAULT_STORAGE_KEY = 'arcwork:layout';

const initialState: ServiceLayoutState = {
  model: null,
  lastSavedLayout: null,
  storageKey: DEFAULT_STORAGE_KEY,
  layoutRef: null,
};

const isBrowser = (): boolean =>
  typeof window !== 'undefined' && typeof localStorage !== 'undefined';

// ==================== 스토어 ====================

export const useServiceStore = create<ServiceLayoutStore>()(
  subscribeWithSelector((set, get) => ({
    ...initialState,

    setModel: (model) => set(() => ({ model })),
    setLayoutRef: (layout) => set(() => ({ layoutRef: layout })),

    setStorageKey: (key) =>
      set(() => ({ storageKey: key || DEFAULT_STORAGE_KEY })),

    saveLayout: (options) => {
      const key = options?.key ?? get().storageKey ?? DEFAULT_STORAGE_KEY;
      const model = get().model;
      if (!model) return;

      try {
        const json = model.toJson();
        if (isBrowser()) {
          localStorage.setItem(key, JSON.stringify(json));
        }
        set(() => ({ lastSavedLayout: json }));
      } catch {
        // noop (필요 시 시스템 전역 에러 스토어와 연동)
      }
    },

    restoreLayout: (options) => {
      const key = options?.key ?? get().storageKey ?? DEFAULT_STORAGE_KEY;
      const replace = options?.replace !== false;

      let json: IJsonModel | null = null;
      if (isBrowser()) {
        const raw = localStorage.getItem(key);
        if (raw) {
          try {
            json = JSON.parse(raw) as IJsonModel;
          } catch {
            json = null;
          }
        }
      }

      if (!json && options?.fallback) {
        json = options.fallback;
      }
      if (!json) return null;

      try {
        const restored = Model.fromJson(json);
        if (replace) {
          set(() => ({ model: restored, lastSavedLayout: json }));
        } else {
          set(() => ({ lastSavedLayout: json }));
        }
        return restored;
      } catch {
        return null;
      }
    },

    clearSavedLayout: (options) => {
      const key = options?.key ?? get().storageKey ?? DEFAULT_STORAGE_KEY;
      if (isBrowser()) {
        localStorage.removeItem(key);
      }
    },

    // =============== Tabs API ===============
    open: (input) => {
      const model = get().model;
      if (!model) return false;

      // already open? just activate
      const maybeNode = model.getNodeById(input.id);
      if (maybeNode && maybeNode.getType && maybeNode.getType() === 'tab') {
        model.doAction(Actions.selectTab(input.id));
        return true;
      }

      // find target tabset
      let toTabsetId = input.tabsetId;
      if (!toTabsetId) {
        const active = model.getActiveTabset() as TabSetNode | undefined;
        if (active) {
          toTabsetId = active.getId();
        } else {
          try {
            const first = model.getFirstTabSet();
            toTabsetId = first.getId();
          } catch {
            return false;
          }
        }
      }

      const json = {
        type: 'tab',
        id: input.id,
        name: input.name ?? input.id,
        component: input.type,
        config: { content: input.content },
      };
      model.doAction(
        Actions.addNode(json, toTabsetId!, DockLocation.CENTER, -1, true)
      );
      return true;
    },

    activate: (id) => {
      const model = get().model;
      if (!model) return false;
      const node = model.getNodeById(id);
      if (!node || node.getType() !== 'tab') return false;
      model.doAction(Actions.selectTab(id));
      return true;
    },

    close: (id) => {
      const model = get().model;
      if (!model) return false;
      const node = model.getNodeById(id);
      if (!node || node.getType() !== 'tab') return false;
      model.doAction(Actions.deleteTab(id));
      return true;
    },

    ensureOpen: (input) => {
      const model = get().model;
      if (!model) return false;
      const node = model.getNodeById(input.id);
      if (node && node.getType() === 'tab') {
        model.doAction(Actions.selectTab(input.id));
        return true;
      }
      return get().open(input);
    },

    makeExternalDragHandler: () => {
      return (event: React.DragEvent<HTMLElement>) => {
        const dt = event.dataTransfer;
        if (!dt) return undefined;
        try {
          const raw = dt.getData('application/x-arcservice') || dt.getData('text/plain');
          if (!raw) return undefined;
          const payload = JSON.parse(raw) as Partial<ServiceOpenTabInput>;
          if (!payload?.id || !payload?.type) return undefined;
          const json = {
            type: 'tab',
            id: payload.id,
            name: payload.name ?? payload.id,
            component: payload.type,
            config: { content: payload.content },
          };
          return {
            json,
          };
        } catch {
          return undefined;
        }
      };
    },

    startAddTabDrag: (event, input, options) => {
      const model = get().model;
      const layout = get().layoutRef;
      if (!layout) {
        // fallback: dataTransfer로만 전달
        try {
          const dt = event.dataTransfer;
          if (dt) {
            const json = JSON.stringify({
              id: input.id,
              type: input.type,
              name: input.name ?? input.id,
              content: input.content,
            });
            dt.setData('application/x-arcservice', json);
            dt.setData('text/plain', json);
          }
        } catch {
          // ignore
        }
        return true;
      }
      const nativeEvent = (event as unknown as { nativeEvent?: DragEvent }).nativeEvent ?? (event as unknown as DragEvent);
      if (options?.dragImage) {
        const off = options.imageOffset ?? { x: 0, y: 0 };
        layout.setDragComponent(nativeEvent as any, options.dragImage, off.x, off.y);
      }
      // 존재하면 move, 없으면 add
      const existing = model?.getNodeById(input.id) as TabNode | undefined;
      if (existing && (existing as any).getType?.() === 'tab') {
        layout.moveTabWithDragAndDrop(nativeEvent as any, existing as any);
        return true;
      }
      const json = {
        type: 'tab',
        id: input.id,
        name: input.name ?? input.id,
        component: input.type,
        config: { content: input.content },
      };
      layout.addTabWithDragAndDrop(nativeEvent as any, json);
      return true;
    },
  }))
);

// ==================== 셀렉터 ====================

export const useServiceModel = (): Model | null =>
  useServiceStore((s) => s.model);

export const useServiceStorageKey = (): string =>
  useServiceStore((s) => s.storageKey);

export const useServiceLastSavedLayout = (): IJsonModel | null =>
  useServiceStore((s) => s.lastSavedLayout);

export const useServiceSetModel = (): ServiceLayoutActions['setModel'] =>
  useServiceStore((s) => s.setModel);

export const useServiceSetStorageKey =
  (): ServiceLayoutActions['setStorageKey'] =>
    useServiceStore((s) => s.setStorageKey);

export const useServiceSaveLayout =
  (): ServiceLayoutActions['saveLayout'] =>
    useServiceStore((s) => s.saveLayout);

export const useServiceRestoreLayout =
  (): ServiceLayoutActions['restoreLayout'] =>
    useServiceStore((s) => s.restoreLayout);

export const useServiceClearSavedLayout =
  (): ServiceLayoutActions['clearSavedLayout'] =>
    useServiceStore((s) => s.clearSavedLayout);

export const useServiceSetLayoutRef =
  (): ServiceLayoutActions['setLayoutRef'] =>
    useServiceStore((s) => s.setLayoutRef);

export const useServiceOpenTab =
  (): ServiceLayoutActions['open'] => useServiceStore((s) => s.open);

export const useServiceActivateTab =
  (): ServiceLayoutActions['activate'] => useServiceStore((s) => s.activate);

export const useServiceCloseTab =
  (): ServiceLayoutActions['close'] => useServiceStore((s) => s.close);

export const useServiceEnsureOpenTab =
  (): ServiceLayoutActions['ensureOpen'] => useServiceStore((s) => s.ensureOpen);

export const useServiceMakeExternalDragHandler =
  (): ServiceLayoutActions['makeExternalDragHandler'] =>
    useServiceStore((s) => s.makeExternalDragHandler);

export const useServiceStartAddTabDrag =
  (): ServiceLayoutActions['startAddTabDrag'] =>
    useServiceStore((s) => s.startAddTabDrag);

// DnD: utility to set drag payload on list items
export function setArcServiceDragData(
  event: DragEvent | React.DragEvent<HTMLElement>,
  data: ServiceOpenTabInput
) {
  const dt = (event as DragEvent).dataTransfer || (event as React.DragEvent<HTMLElement>).dataTransfer;
  if (!dt) return;
  const json = JSON.stringify({ id: data.id, type: data.type, name: data.name, content: data.content });
  try {
    dt.setData('application/x-arcservice', json);
  } catch {
    // ignore
  }
  try {
    dt.setData('text/plain', json);
  } catch {
    // ignore
  }
}


