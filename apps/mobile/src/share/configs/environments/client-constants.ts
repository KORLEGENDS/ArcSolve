/**
 * 클라이언트 환경 상수
 */

export const isDevelopment = __DEV__;
export const isProduction = !__DEV__;

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:3000';

