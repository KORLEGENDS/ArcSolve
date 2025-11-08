import type { UIMessage } from 'ai';

/**
 * 메시지 배열에서 마지막 data-summary 파트를 가진 메시지의 인덱스를 찾는 유틸리티 함수
 * @param messages - 검색할 메시지 배열
 * @returns 마지막 data-summary 메시지의 인덱스, 없으면 -1
 */
export function findLastSummaryIndex(messages: UIMessage[]): number {
  for (let i = messages.length - 1; i >= 0; i--) {
    const parts = (messages[i]?.parts ?? []) as { type?: string }[];
    if (parts.some((p) => p.type === 'data-summary')) return i;
  }
  return -1;
}

/**
 * 텍스트를 지정된 길이로 자르는 유틸리티 함수
 * @param text - 자를 텍스트
 * @param limit - 최대 길이
 * @param showTrimmedMessage - 트림 메시지를 표시할지 여부 (기본값: false)
 * @returns 잘린 텍스트
 */
export function trimToLimit(text: string, limit: number, showTrimmedMessage = false): string {
  if (!text) return '';

  if (text.length <= limit) return text;

  const trimmed = text.slice(0, limit);

  if (showTrimmedMessage) {
    return `${trimmed}\n\n... [TRIMMED] (${text.length - limit} chars omitted)`;
  }

  return trimmed;
}

/**
 * 두 텍스트의 차이를 라인 기반으로 계산합니다.
 * @param prev - 이전 텍스트
 * @param next - 신규 텍스트
 * @returns 추가된 라인들을 개행으로 이어붙인 문자열
 */
// 제거: 파일 리소스의 DIFF 모드는 사용하지 않으므로 라인 기반 diff 유틸도 제거되었습니다.

export interface ResourceContextMetaLite {
  kind: 'note' | 'file';
  id: string;
  name: string;
  itemType: 'item' | 'folder';
  mimeType?: string;
}

export type ResourceContextItemLite =
  | { meta: ResourceContextMetaLite; mode: 'meta-only' };

export function formatResourceContextItem(resource: ResourceContextItemLite): string {
  const { meta } = resource;
  const mime = meta.mimeType ? ` <${meta.mimeType}>` : '';
  const header = `[${meta.kind.toUpperCase()}] ${meta.name} (${meta.id})${mime}`;
  return header;
}

/**
 * 텍스트에서 지정된 범위(startIdx, endIdx)를 추출하는 유틸리티 함수
 * @param text - 대상 텍스트
 * @param startIdx - 시작 인덱스 (옵션)
 * @param endIdx - 끝 인덱스 (옵션)
 * @returns 추출된 텍스트
 */
export function sliceByRange(text: string, startIdx?: number, endIdx?: number): string {
  if (!text) return '';
  const s = Math.max(0, startIdx ?? 0);
  const e = endIdx !== undefined ? Math.max(s, Math.min(endIdx, text.length)) : text.length;
  return text.slice(s, e);
}

// GetTexts 도구를 위한 공통 타입들
export interface GetTextsResultItem {
  id: string;
  text: string;
}

export interface GetTextsResult {
  results: GetTextsResultItem[];
}
