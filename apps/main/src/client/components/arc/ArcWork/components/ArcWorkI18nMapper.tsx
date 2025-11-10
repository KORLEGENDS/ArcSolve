'use client';

import type { I18nLabel } from 'flexlayout-react';

/**
 * 다국어 라벨 매퍼 타입
 */
export type I18nMapper = (id: I18nLabel, param?: string) => string | undefined;

/**
 * 기본 다국어 라벨 매퍼
 * flexlayout-react의 기본 라벨을 반환합니다
 */
export function defaultI18nMapper(id: I18nLabel, param?: string): string | undefined {
  // 기본 라벨 매핑
  const labels: Partial<Record<I18nLabel, string>> = {
    Close: '닫기',
    Maximize: '최대화',
    Minimize: '최소화',
    Restore: '복원',
    FloatTab: '탭 분리',
    'Dock to': '도킹',
    'Dock to Left': '왼쪽에 도킹',
    'Dock to Right': '오른쪽에 도킹',
    'Dock to Top': '위에 도킹',
    'Dock to Bottom': '아래에 도킹',
    'Dock to Center': '중앙에 도킹',
    'Undock': '도킹 해제',
    'Delete Tab': '탭 삭제',
    'Add Tab': '탭 추가',
    'Rename Tab': '탭 이름 변경',
    'Move Tab': '탭 이동',
    'Move Tab to New Window': '새 창으로 탭 이동',
    'Move Tab to Next': '다음으로 탭 이동',
    'Move Tab to Previous': '이전으로 탭 이동',
    'Move Tab to First': '첫 번째로 탭 이동',
    'Move Tab to Last': '마지막으로 탭 이동',
    'Move Tab to Left': '왼쪽으로 탭 이동',
    'Move Tab to Right': '오른쪽으로 탭 이동',
    'Move Tab to Top': '위로 탭 이동',
    'Move Tab to Bottom': '아래로 탭 이동',
    'Move Tab to Center': '중앙으로 탭 이동',
    'Move Tab to Next Tabset': '다음 탭셋으로 이동',
    'Move Tab to Previous Tabset': '이전 탭셋으로 이동',
    'Move Tab to First Tabset': '첫 번째 탭셋으로 이동',
    'Move Tab to Last Tabset': '마지막 탭셋으로 이동',
    'Move Tab to Left Tabset': '왼쪽 탭셋으로 이동',
    'Move Tab to Right Tabset': '오른쪽 탭셋으로 이동',
    'Move Tab to Top Tabset': '위 탭셋으로 이동',
    'Move Tab to Bottom Tabset': '아래 탭셋으로 이동',
    'Move Tab to Center Tabset': '중앙 탭셋으로 이동',
    'Move Tab to New Tabset': '새 탭셋으로 이동',
    'Move Tab to New Window': '새 창으로 이동',
    'Move Tab to New Popout': '새 팝아웃으로 이동',
    'Move Tab to New Floating Window': '새 플로팅 창으로 이동',
    'Move Tab to New Dock Window': '새 도킹 창으로 이동',
    'Move Tab to New Split': '새 분할로 이동',
    'Move Tab to New Split Horizontal': '새 가로 분할로 이동',
    'Move Tab to New Split Vertical': '새 세로 분할로 이동',
    'Move Tab to New Tab': '새 탭으로 이동',
    'Move Tab to New Tabset Horizontal': '새 가로 탭셋으로 이동',
    'Move Tab to New Tabset Vertical': '새 세로 탭셋으로 이동',
    'Move Tab to New Border': '새 보더로 이동',
    'Move Tab to New Border Left': '새 왼쪽 보더로 이동',
    'Move Tab to New Border Right': '새 오른쪽 보더로 이동',
    'Move Tab to New Border Top': '새 위 보더로 이동',
    'Move Tab to New Border Bottom': '새 아래 보더로 이동',
    'Move Tab to New Border Center': '새 중앙 보더로 이동',
  };

  return labels[id] || id;
}

/**
 * 다국어 라벨 매퍼 생성 함수
 */
export function createI18nMapper(customMapper?: I18nMapper): I18nMapper {
  return (id: I18nLabel, param?: string) => {
    // 커스텀 매퍼가 있으면 먼저 시도
    if (customMapper) {
      const result = customMapper(id, param);
      if (result !== undefined) {
        return result;
      }
    }

    // 기본 매퍼 실행
    return defaultI18nMapper(id, param);
  };
}

