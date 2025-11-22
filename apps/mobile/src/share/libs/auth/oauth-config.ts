/**
 * OAuth 설정
 * 카카오/네이버 OAuth 프로바이더 설정
 * 
 * 참고: React Native에서는 NextAuth의 웹 기반 OAuth 플로우를 직접 사용할 수 없으므로,
 * WebView를 통해 웹 로그인 페이지를 열거나, 각 프로바이더의 네이티브 SDK를 사용해야 합니다.
 * 
 * 여기서는 WebView를 통한 접근 방식을 기본으로 합니다.
 */

import { API_BASE_URL } from '@/share/configs/environments/client-constants';
import * as AuthSession from 'expo-auth-session';

// 환경 변수에서 가져오기
const KAKAO_CLIENT_ID = process.env.EXPO_PUBLIC_KAKAO_CLIENT_ID || '';
const NAVER_CLIENT_ID = process.env.EXPO_PUBLIC_NAVER_CLIENT_ID || '';

// Redirect URI 생성
const redirectUri = AuthSession.makeRedirectUri({
  scheme: 'arcsolve',
  path: 'auth',
});

/**
 * OAuth 프로바이더 타입
 */
export type OAuthProvider = 'kakao' | 'naver';

/**
 * NextAuth 로그인 URL 생성
 * WebView를 통해 웹 로그인 페이지를 엽니다.
 */
export function getAuthUrl(provider: OAuthProvider): string {
  const callbackUrl = encodeURIComponent(`${API_BASE_URL}/api/auth/callback/${provider}`);
  return `${API_BASE_URL}/api/auth/signin/${provider}?callbackUrl=${callbackUrl}`;
}

/**
 * 카카오 OAuth 설정 (네이티브 SDK 사용 시)
 */
export const kakaoAuthConfig: AuthSession.AuthRequestConfig = {
  clientId: KAKAO_CLIENT_ID,
  scopes: ['profile_nickname', 'account_email'],
  redirectUri,
  responseType: AuthSession.ResponseType.Code,
  authorizationEndpoint: 'https://kauth.kakao.com/oauth/authorize',
  tokenEndpoint: `${API_BASE_URL}/api/auth/callback/kakao`,
};

/**
 * 네이버 OAuth 설정 (네이티브 SDK 사용 시)
 */
export const naverAuthConfig: AuthSession.AuthRequestConfig = {
  clientId: NAVER_CLIENT_ID,
  scopes: ['name', 'email'],
  redirectUri,
  responseType: AuthSession.ResponseType.Code,
  authorizationEndpoint: 'https://nid.naver.com/oauth2.0/authorize',
  tokenEndpoint: `${API_BASE_URL}/api/auth/callback/naver`,
};

/**
 * 프로바이더별 설정 가져오기
 */
export function getAuthConfig(provider: OAuthProvider): AuthSession.AuthRequestConfig {
  switch (provider) {
    case 'kakao':
      return kakaoAuthConfig;
    case 'naver':
      return naverAuthConfig;
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

