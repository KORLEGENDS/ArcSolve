import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

/**
 * 전역 시스템 상태 관리 스토어
 * 전역 컴포넌트들의 상태를 중앙에서 관리합니다.
 */

export interface SystemState {
  // 로딩 상태들
  loading: {
    active: boolean;
    type: 'spinner' | 'dots' | 'pulse' | 'bars';
    text: string;
    size: 'sm' | 'md' | 'lg';
    variant: 'default' | 'blue' | 'green' | 'yellow' | 'red' | 'glass';
    withBackground: boolean;
  };

  // 에러 상태들
  error: {
    active: boolean;
    type: 'warning' | 'critical' | 'info';
    source?: 'provider' | 'app' | 'network' | 'auth';
    message: string;
    details?: string;
    digest?: string;
  };

  // 네트워크 상태
  networkStatus: {
    status: 'online' | 'offline' | 'slow';
    message?: string;
  };

  // 성공 상태
  success: {
    active: boolean;
    message: string;
  };
}

export interface SystemActions {
  // 로딩 액션들
  setLoading: (loading: Partial<SystemState['loading']>) => void;
  showLoading: (options?: {
    type?: SystemState['loading']['type'];
    text?: string;
    size?: SystemState['loading']['size'];
    variant?: SystemState['loading']['variant'];
    withBackground?: SystemState['loading']['withBackground'];
  }) => void;
  hideLoading: () => void;

  // 에러 액션들
  setError: (error: Partial<SystemState['error']>) => void;
  showError: (
    message: string,
    type?: 'warning' | 'critical' | 'info',
    details?: string,
    source?: SystemState['error']['source']
  ) => void;
  hideError: () => void;

  // 네트워크 액션들
  setNetworkStatus: (status: Partial<SystemState['networkStatus']>) => void;

  // 성공 액션들
  setSuccess: (success: Partial<SystemState['success']>) => void;
  showSuccess: (message: string) => void;
  hideSuccess: () => void;

  // 전체 리셋
  resetAllStates: () => void;
}

type SystemStore = SystemState & SystemActions;

// 초기 상태
const initialState: SystemState = {
  loading: {
    active: false,
    type: 'spinner',
    text: '로딩 중...',
    size: 'md',
    variant: 'default',
    withBackground: false,
  },
  error: {
    active: false,
    type: 'critical',
    source: undefined,
    message: '',
    details: undefined,
    digest: undefined,
  },
  networkStatus: {
    status: 'online',
    message: undefined,
  },
  success: {
    active: false,
    message: '',
  },
};

export const useSystemStore = create<SystemStore>()(
  subscribeWithSelector((set, get) => ({
    ...initialState,

    // 로딩 액션들
    setLoading: (loading): void =>
      set((state) => ({
        loading: { ...state.loading, ...loading },
      })),

    showLoading: (options = {}): void =>
      set((state) => ({
        loading: {
          ...state.loading,
          active: true,
          ...options,
        },
      })),

    hideLoading: (): void =>
      set((state) => ({
        loading: { ...state.loading, active: false },
      })),

    // 에러 액션들
    setError: (error): void =>
      set((state) => ({
        error: { ...state.error, ...error },
      })),

    showError: (message, type = 'critical', details, source = 'app'): void =>
      set((state) => ({
        error: {
          ...state.error,
          active: true,
          message,
          type,
          details,
          source,
          digest: `${source}-error-${Date.now()}`,
        },
      })),

    hideError: (): void =>
      set((state) => ({
        error: { ...state.error, active: false },
      })),

    // 네트워크 액션들
    setNetworkStatus: (status): void =>
      set((state) => ({
        networkStatus: { ...state.networkStatus, ...status },
      })),

    // 성공 액션들
    setSuccess: (success): void =>
      set((state) => ({
        success: { ...state.success, ...success },
      })),

    showSuccess: (message): void =>
      set((state) => ({
        success: { ...state.success, active: true, message },
      })),

    hideSuccess: (): void =>
      set((state) => ({
        success: { ...state.success, active: false },
      })),

    // 전체 리셋
    resetAllStates: (): void => set(() => initialState),
  }))
);

// 개별 셀렉터들 (성능 최적화)
export const useSystemLoading = (): SystemState['loading'] =>
  useSystemStore((state) => state.loading);
export const useSystemError = (): SystemState['error'] =>
  useSystemStore((state) => state.error);
export const useSystemNetworkStatus = (): SystemState['networkStatus'] =>
  useSystemStore((state) => state.networkStatus);
export const useSystemSuccess = (): SystemState['success'] =>
  useSystemStore((state) => state.success);

// 개별 액션 셀렉터들 (무한 렌더링 방지)
export const useSystemShowLoading = (): SystemActions['showLoading'] =>
  useSystemStore((state) => state.showLoading);
export const useSystemHideLoading = (): SystemActions['hideLoading'] =>
  useSystemStore((state) => state.hideLoading);
export const useSystemShowError = (): SystemActions['showError'] =>
  useSystemStore((state) => state.showError);
export const useSystemHideError = (): SystemActions['hideError'] =>
  useSystemStore((state) => state.hideError);
export const useSystemSetNetworkStatus =
  (): SystemActions['setNetworkStatus'] =>
    useSystemStore((state) => state.setNetworkStatus);
export const useSystemShowSuccess = (): SystemActions['showSuccess'] =>
  useSystemStore((state) => state.showSuccess);
export const useSystemHideSuccess = (): SystemActions['hideSuccess'] =>
  useSystemStore((state) => state.hideSuccess);
export const useSystemResetAllStates = (): SystemActions['resetAllStates'] =>
  useSystemStore((state) => state.resetAllStates);

