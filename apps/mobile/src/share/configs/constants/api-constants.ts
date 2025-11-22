/**
 * API 관련 상수
 */

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:3000';

export const API_ENDPOINTS = {
  AUTH: '/api/auth',
  DOCUMENT: '/api/document',
  ARCYOU: '/api/arcyou',
} as const;

