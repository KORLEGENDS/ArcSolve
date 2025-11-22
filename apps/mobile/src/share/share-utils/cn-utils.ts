/**
 * className 유틸리티 함수
 * React Native에서는 clsx만 사용 (tailwind-merge는 웹 전용)
 */

import { clsx, type ClassValue } from 'clsx';

export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}

