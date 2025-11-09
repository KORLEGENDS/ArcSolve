// ArcWork 컴포넌트 관련 상수 정의

// 테마 관련 타입 및 상수
export type ArcWorkTheme = 'light' | 'dark';
export const ARCWORK_DEFAULT_THEME = 'light' as const;

// 쿠키 관련 상수
export const ARCWORK_THEME_COOKIE_NAME = 'arcwork:theme';
export const ARCWORK_THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1년

