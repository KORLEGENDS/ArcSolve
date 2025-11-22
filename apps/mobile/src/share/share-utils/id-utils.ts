/**
 * ID 생성 유틸리티
 */

import { nanoid } from 'nanoid';

/**
 * 고유 ID 생성
 */
export function generateId(): string {
  return nanoid();
}

/**
 * 타임스탬프 기반 ID 생성
 */
export function generateTimestampId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

