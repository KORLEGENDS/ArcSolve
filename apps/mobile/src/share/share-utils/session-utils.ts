/**
 * 세션 관리 유틸리티
 * SecureStore를 사용한 세션 정보 및 토큰 저장/조회
 */

import * as SecureStore from 'expo-secure-store';

const SESSION_KEY = 'auth_session';
const SESSION_EXPIRY_KEY = 'auth_session_expiry';
const ACCESS_TOKEN_KEY = 'auth_access_token';
const TOKEN_EXPIRY_KEY = 'auth_token_expiry';
const REFRESH_TOKEN_KEY = 'auth_refresh_token';

export interface SessionData {
  user: {
    id: string;
    email?: string;
    name?: string;
    image?: string;
  };
  expires?: string;
}

export interface TokenData {
  token: string;
  expiresIn?: string; // 예: "30d", "5m" 등
  expiresAt?: number; // epoch seconds
}

/**
 * 세션 정보 저장
 */
export async function saveSession(session: SessionData): Promise<void> {
  try {
    await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
    if (session.expires) {
      await SecureStore.setItemAsync(SESSION_EXPIRY_KEY, session.expires);
    }
  } catch (error) {
    console.error('Failed to save session:', error);
    throw error;
  }
}

/**
 * 세션 정보 조회
 */
export async function getSession(): Promise<SessionData | null> {
  try {
    const sessionStr = await SecureStore.getItemAsync(SESSION_KEY);
    if (!sessionStr) {
      return null;
    }

    const session = JSON.parse(sessionStr) as SessionData;

    // 만료 체크
    const expiryStr = await SecureStore.getItemAsync(SESSION_EXPIRY_KEY);
    if (expiryStr && session.expires) {
      const expiry = new Date(expiryStr);
      if (expiry < new Date()) {
        await clearSession();
        return null;
      }
    }

    return session;
  } catch (error) {
    console.error('Failed to get session:', error);
    return null;
  }
}

/**
 * 세션 정보 삭제
 */
export async function clearSession(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(SESSION_KEY);
    await SecureStore.deleteItemAsync(SESSION_EXPIRY_KEY);
    await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
    await SecureStore.deleteItemAsync(TOKEN_EXPIRY_KEY);
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  } catch (error) {
    console.error('Failed to clear session:', error);
  }
}

/**
 * 세션 만료 체크
 */
export async function isSessionExpired(): Promise<boolean> {
  try {
    const expiryStr = await SecureStore.getItemAsync(SESSION_EXPIRY_KEY);
    if (!expiryStr) {
      return true;
    }

    const expiry = new Date(expiryStr);
    return expiry < new Date();
  } catch {
    return true;
  }
}

// ==================== 토큰 관리 ====================

/**
 * 액세스 토큰 저장
 * 
 * @param tokenData 토큰 데이터 (토큰 문자열 및 만료 정보)
 */
export async function saveAccessToken(tokenData: TokenData): Promise<void> {
  try {
    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, tokenData.token);
    
    // 만료 시간 저장
    if (tokenData.expiresAt) {
      await SecureStore.setItemAsync(TOKEN_EXPIRY_KEY, tokenData.expiresAt.toString());
    } else if (tokenData.expiresIn) {
      // expiresIn을 파싱하여 expiresAt 계산
      const expiresAt = parseExpiresIn(tokenData.expiresIn);
      if (expiresAt) {
        await SecureStore.setItemAsync(TOKEN_EXPIRY_KEY, expiresAt.toString());
      }
    }
  } catch (error) {
    console.error('Failed to save access token:', error);
    throw error;
  }
}

/**
 * 액세스 토큰 조회
 * 
 * @returns 토큰 문자열 또는 null (만료된 경우에도 null 반환)
 */
export async function getAccessToken(): Promise<string | null> {
  try {
    const token = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
    if (!token) {
      return null;
    }

    // 만료 체크
    const expiryStr = await SecureStore.getItemAsync(TOKEN_EXPIRY_KEY);
    if (expiryStr) {
      const expiry = parseInt(expiryStr, 10);
      const now = Math.floor(Date.now() / 1000);
      if (expiry <= now) {
        // 토큰 만료 - 삭제
        await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
        await SecureStore.deleteItemAsync(TOKEN_EXPIRY_KEY);
        return null;
      }
    }

    return token;
  } catch (error) {
    console.error('Failed to get access token:', error);
    return null;
  }
}

/**
 * 토큰 만료 체크
 */
export async function isTokenExpired(): Promise<boolean> {
  try {
    const expiryStr = await SecureStore.getItemAsync(TOKEN_EXPIRY_KEY);
    if (!expiryStr) {
      return true;
    }

    const expiry = parseInt(expiryStr, 10);
    const now = Math.floor(Date.now() / 1000);
    return expiry <= now;
  } catch {
    return true;
  }
}

/**
 * expiresIn 문자열을 epoch seconds로 변환
 * 
 * @param expiresIn 예: "30d", "5m", "1h", "3600" (초)
 * @returns epoch seconds 또는 null
 */
function parseExpiresIn(expiresIn: string): number | null {
  try {
    const now = Math.floor(Date.now() / 1000);
    const match = expiresIn.match(/^(\d+)([smhd])?$/);
    
    if (!match) {
      // 숫자만 있는 경우 초로 간주
      const seconds = parseInt(expiresIn, 10);
      return isNaN(seconds) ? null : now + seconds;
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];

    let seconds: number;
    switch (unit) {
      case 's':
        seconds = value;
        break;
      case 'm':
        seconds = value * 60;
        break;
      case 'h':
        seconds = value * 60 * 60;
        break;
      case 'd':
        seconds = value * 24 * 60 * 60;
        break;
      default:
        seconds = value;
    }

    return now + seconds;
  } catch {
    return null;
  }
}

// ==================== Refresh Token 관리 ====================

/**
 * Refresh Token 저장
 * 
 * @param token Refresh Token 문자열
 */
export async function saveRefreshToken(token: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token);
  } catch (error) {
    console.error('Failed to save refresh token:', error);
    throw error;
  }
}

/**
 * Refresh Token 조회
 * 
 * @returns Refresh Token 문자열 또는 null
 */
export async function getRefreshToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  } catch (error) {
    console.error('Failed to get refresh token:', error);
    return null;
  }
}

/**
 * Refresh Token 삭제
 */
export async function clearRefreshToken(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  } catch (error) {
    console.error('Failed to clear refresh token:', error);
  }
}

