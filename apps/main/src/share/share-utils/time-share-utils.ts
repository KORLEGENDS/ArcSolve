import { formatDuration } from '@/share/configs/constants/time-constants';

export function toIsoString(
  value: Date | string | null | undefined
): string | undefined {
  if (value == null) return undefined;
  if (value instanceof Date) return value.toISOString();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

/**
 * TTL을 사람이 읽기 쉬운 형태로 포맷
 * 예: 3661 → "1시간 1분 1초"
 */
export function formatTTL(ttl: number): string {
  if (ttl < 0) return '만료됨';
  if (ttl === 0) return '영구';
  return formatDuration(ttl * 1000);
}

/**
 * 초 단위 시간을 사람이 읽기 쉬운 형태로 포맷 (분 초)
 * 예: 125 → "2분 5초", 30 → "30초", 120 → "2분"
 */
export function formatDurationInSeconds(seconds: number): string {
  const totalSeconds = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;

  if (minutes === 0) {
    return `${remainingSeconds}초`;
  }

  if (remainingSeconds === 0) {
    return `${minutes}분`;
  }

  return `${minutes}분 ${remainingSeconds}초`;
}

/**
 * 초 단위 시간을 MM:SS 형태로 포맷
 * 예: 125 → "02:05", 30 → "00:30"
 */
export function formatTimeInSeconds(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}


