import { createNavigation } from 'next-intl/navigation';
import { defineRouting } from 'next-intl/routing';
/**
 * 공유 i18n 라우팅 엔트리포인트
 *
 * - localePrefix: 'always' 정책 (모든 URL은 항상 접두어 포함)
 * - 클라이언트 전용: Link, redirect, useRouter, usePathname, getPathname
 * - 서버/엣지 전용: extractLocaleFromPathname, removeLocaleFromPathname, getLocalizedPath
 *   (서버 파일에서는 컴포넌트/훅을 import하지 마세요)
 */

export const routing = defineRouting({
	locales: ['ko', 'en'],
	defaultLocale: 'ko',
	localePrefix: 'always',
});

export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);

/**
 * locale을 포함한 경로 생성
 * localePrefix: 'always' 환경에서는 모든 경로에 locale 접두어가 포함됨
 *
 * @param locale - 대상 locale ('ko', 'en')
 * @param path - locale 제외된 경로 (예: '/login', '/about')
 * @returns locale이 포함된 경로 (예: '/ko/login', '/en/login')
 *
 * @example
 * ```ts
 * // 서버 컴포넌트/미들웨어
 * const locale = extractLocaleFromPathname(pathname);
 * const loginPath = getLocalizedPath(locale, '/login'); // '/ko/login' 또는 '/en/login'
 *
 * // 클라이언트 컴포넌트
 * const locale = useLocale();
 * const loginPath = getLocalizedPath(locale, '/login'); // '/ko/login' 또는 '/en/login'
 * ```
 */
export function getLocalizedPath(locale: string, path: string): string {
	// path가 이미 '/'로 시작하는지 확인
	const normalizedPath = path.startsWith('/') ? path : `/${path}`;
	return `/${locale}${normalizedPath}`;
}

/**
 * pathname에서 locale 추출
 * 서버/미들웨어에서 사용
 *
 * @param pathname - 전체 pathname (예: '/ko/login', '/en/about', '/login')
 * @returns 추출된 locale 또는 기본 locale
 *
 * @example
 * ```ts
 * const locale = extractLocaleFromPathname('/ko/login'); // 'ko'
 * const locale = extractLocaleFromPathname('/en/about'); // 'en'
 * const locale = extractLocaleFromPathname('/login'); // 'ko' (기본값)
 * ```
 */
export function extractLocaleFromPathname(pathname: string): string {
	const segments = pathname.split('/').filter(Boolean);
	if (segments.length > 0 && routing.locales.includes(segments[0] as any)) {
		return segments[0];
	}
	return routing.defaultLocale;
}

/**
 * pathname에서 locale 제거
 * 서버/미들웨어에서 사용
 *
 * @param pathname - 전체 pathname (예: '/ko/login', '/en/about', '/login')
 * @returns locale이 제거된 경로 (예: '/login', '/about', '/login')
 *
 * @example
 * ```ts
 * const path = removeLocaleFromPathname('/ko/login'); // '/login'
 * const path = removeLocaleFromPathname('/en/about'); // '/about'
 * const path = removeLocaleFromPathname('/login'); // '/login'
 * ```
 */
export function removeLocaleFromPathname(pathname: string): string {
	const segments = pathname.split('/').filter(Boolean);
	if (segments.length > 0 && routing.locales.includes(segments[0] as any)) {
		return '/' + segments.slice(1).join('/');
	}
	return pathname;
}
