import { useTheme } from 'next-themes';
import * as React from 'react';
import {
  ARCWORK_DEFAULT_THEME,
  ARCWORK_THEME_COOKIE_MAX_AGE,
  ARCWORK_THEME_COOKIE_NAME,
  type ArcWorkTheme,
} from '../ArcWork-config';

export interface UseArcWorkThemeProps {
  /**
   * 초기 테마 (서버에서 쿠키를 읽어 전달)
   * next-themes의 resolvedTheme이 없을 때만 사용됩니다 (초기 렌더링 fallback)
   */
  initialTheme?: ArcWorkTheme;
  /**
   * 쿠키 이름 (기본값: ARCWORK_THEME_COOKIE_NAME)
   */
  cookieName?: string;
  /**
   * 쿠키 만료 시간 (초, 기본값: ARCWORK_THEME_COOKIE_MAX_AGE)
   */
  cookieMaxAge?: number;
}

export interface UseArcWorkThemeReturn {
  /**
   * 현재 테마
   */
  theme: ArcWorkTheme;
  /**
   * 테마 클래스명 (flexlayout__theme_light 또는 flexlayout__theme_dark)
   */
  themeClass: string;
}

/**
 * ArcWork 테마 관리 훅
 * next-themes의 resolvedTheme과 동기화하고, 테마 변경 시 쿠키에 기록합니다.
 */
export function useArcWorkTheme({
  initialTheme,
  cookieName = ARCWORK_THEME_COOKIE_NAME,
  cookieMaxAge = ARCWORK_THEME_COOKIE_MAX_AGE,
}: UseArcWorkThemeProps = {}): UseArcWorkThemeReturn {
  const { resolvedTheme } = useTheme();

  // 테마 결정: resolvedTheme 우선, 없으면 initialTheme 사용
  const theme = React.useMemo<ArcWorkTheme>(() => {
    if (resolvedTheme === 'dark') {
      return 'dark';
    }
    if (resolvedTheme === 'light') {
      return 'light';
    }
    // resolvedTheme이 undefined인 경우(초기 렌더링) initialTheme 사용
    return initialTheme ?? ARCWORK_DEFAULT_THEME;
  }, [resolvedTheme, initialTheme]);

  // 테마 클래스명 생성
  const themeClass = React.useMemo(() => {
    return `flexlayout__theme_${theme}`;
  }, [theme]);

  // 테마 변경 시 쿠키에 기록
  React.useEffect(() => {
    // resolvedTheme이 있을 때만 쿠키에 기록 (초기 렌더링 시 undefined일 수 있음)
    if (resolvedTheme !== 'dark' && resolvedTheme !== 'light') {
      return;
    }

    // 현재 쿠키 값과 동일하면 재기록 방지
    const current = document.cookie
      .split('; ')
      .find((row) => row.startsWith(`${cookieName}=`));
    const currentValue = current?.split('=')[1];
    if (currentValue === theme) {
      return;
    }

    const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
    const secureAttr = isHttps ? '; Secure' : '';
    // 표준 속성 표기 사용(SameSite=Lax)
    document.cookie = `${cookieName}=${theme}; Path=/; Max-Age=${cookieMaxAge}; SameSite=Lax${secureAttr}`;
  }, [theme, resolvedTheme, cookieName, cookieMaxAge]);

  return {
    theme,
    themeClass,
  };
}

