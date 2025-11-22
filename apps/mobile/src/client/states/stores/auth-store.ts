/**
 * 인증 상태 관리 스토어
 * Access Token과 사용자 정보를 전역 상태로 관리
 */

import { create } from 'zustand';
import type { SessionData } from '@/share/share-utils/session-utils';

export interface AuthState {
  // 사용자 정보
  user: SessionData['user'] | null;
  // Access Token (메모리에만 저장, 앱 재시작 시 삭제)
  accessToken: string | null;
  // 인증 상태
  isAuthenticated: boolean;
  // 로딩 상태
  isLoading: boolean;
}

export interface AuthActions {
  // 인증 정보 설정
  setAuth: (user: SessionData['user'], accessToken: string) => void;
  // Access Token만 업데이트 (사용자 정보는 유지)
  setAccessToken: (accessToken: string | null) => void;
  // 인증 정보 초기화
  clearAuth: () => void;
  // 로딩 상태 설정
  setLoading: (loading: boolean) => void;
}

type AuthStore = AuthState & AuthActions;

// 초기 상태
const initialState: AuthState = {
  user: null,
  accessToken: null,
  isAuthenticated: false,
  isLoading: false,
};

export const useAuthStore = create<AuthStore>((set) => ({
  ...initialState,

  setAuth: (user, accessToken) =>
    set({
      user,
      accessToken,
      isAuthenticated: true,
      isLoading: false,
    }),

  setAccessToken: (accessToken) =>
    set((state) => ({
      accessToken,
      isAuthenticated: !!accessToken && !!state.user,
    })),

  clearAuth: () =>
    set({
      ...initialState,
    }),

  setLoading: (loading) =>
    set({
      isLoading: loading,
    }),
}));

// 개별 셀렉터들 (성능 최적화)
export const useAuthUser = (): AuthState['user'] =>
  useAuthStore((state) => state.user);
export const useAuthAccessToken = (): AuthState['accessToken'] =>
  useAuthStore((state) => state.accessToken);
export const useAuthIsAuthenticated = (): AuthState['isAuthenticated'] =>
  useAuthStore((state) => state.isAuthenticated);
export const useAuthIsLoading = (): AuthState['isLoading'] =>
  useAuthStore((state) => state.isLoading);

