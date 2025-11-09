import * as React from 'react';
import {
  SIDEBAR_COOKIE_MAX_AGE,
  SIDEBAR_COOKIE_NAME,
  SIDEBAR_WIDTH,
} from '../ArcSide-config';
import { isCompactFrom } from '../utils/dimension';

export interface UseSidebarStateProps {
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultWidth?: string;
  cookieKeyPrefix?: string;
  stateCookieName?: string;
  widthCookieName?: string;
  widthCookieMaxAge?: number;
}

export interface UseSidebarStateReturn {
  // 상태
  open: boolean;
  width: string;
  isDraggingRail: boolean;
  state: 'expanded' | 'collapsed';
  isCompact: boolean;

  // 상태 변경 함수
  setOpen: (value: boolean | ((value: boolean) => boolean)) => void;
  setWidth: (width: string) => void;
  setIsDraggingRail: (isDraggingRail: boolean) => void;
  toggleSidebar: () => void;

  // 쿠키 설정
  stateCookieName: string;
  widthCookieName: string;
  widthCookieMaxAge: number;
}

/**
 * 사이드바 상태 관리 훅
 * 모든 상태 관리 로직, 쿠키 관리, 상태 파생을 담당합니다.
 */
export function useSidebarState({
  defaultOpen = true,
  open: openProp,
  onOpenChange: setOpenProp,
  defaultWidth = SIDEBAR_WIDTH,
  cookieKeyPrefix,
  stateCookieName: stateCookieNameProp,
  widthCookieName: widthCookieNameProp,
  widthCookieMaxAge: widthCookieMaxAgeProp,
}: UseSidebarStateProps): UseSidebarStateReturn {
  //* 상태 관리
  const [width, setWidth] = React.useState(defaultWidth);
  const [isDraggingRail, setIsDraggingRail] = React.useState(false);
  const [_open, _setOpen] = React.useState(defaultOpen);

  // 외부 제어 또는 내부 상태 사용
  const open = openProp ?? _open;

  //* 쿠키 이름 파생
  const derivedStateCookieName = React.useMemo(() => {
    if (stateCookieNameProp) return stateCookieNameProp;
    return cookieKeyPrefix
      ? `sidebar:${cookieKeyPrefix}:state`
      : SIDEBAR_COOKIE_NAME;
  }, [cookieKeyPrefix, stateCookieNameProp]);

  const derivedWidthCookieName = React.useMemo(() => {
    if (widthCookieNameProp) return widthCookieNameProp;
    return cookieKeyPrefix
      ? `sidebar:${cookieKeyPrefix}:width`
      : 'sidebar:width';
  }, [cookieKeyPrefix, widthCookieNameProp]);

  const derivedWidthCookieMaxAge = React.useMemo(() => {
    return widthCookieMaxAgeProp ?? SIDEBAR_COOKIE_MAX_AGE;
  }, [widthCookieMaxAgeProp]);

  //* 상태 변경 함수 (쿠키 저장 포함)
  const setOpen = React.useCallback(
    (value: boolean | ((value: boolean) => boolean)) => {
      const openState = typeof value === 'function' ? value(open) : value;
      if (setOpenProp) {
        setOpenProp(openState);
      } else {
        _setOpen(openState);
      }

      // 쿠키에 상태 저장
      document.cookie = `${derivedStateCookieName}=${openState}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`;
    },
    [setOpenProp, open, derivedStateCookieName]
  );

  //* 사이드바 토글 함수
  const toggleSidebar = React.useCallback((): void => {
    setOpen((open) => !open);
  }, [setOpen]);

  //* 상태 파생
  const state = React.useMemo(
    () => (open ? 'expanded' : 'collapsed'),
    [open]
  );

  const isCompact = React.useMemo(
    () => isCompactFrom(state, width),
    [state, width]
  );

  return {
    // 상태
    open,
    width,
    isDraggingRail,
    state,
    isCompact,

    // 상태 변경 함수
    setOpen,
    setWidth,
    setIsDraggingRail,
    toggleSidebar,

    // 쿠키 설정
    stateCookieName: derivedStateCookieName,
    widthCookieName: derivedWidthCookieName,
    widthCookieMaxAge: derivedWidthCookieMaxAge,
  };
}

