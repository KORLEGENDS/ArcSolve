/**
 * 경로 관련 상수 정의
 * 노트, 파일 등의 경로 처리에 사용되는 중앙화된 상수
 */

/**
 * 기본 경로 상수
 */
export const PATH_CONSTANTS = {
  /**
   * 루트 경로
   */
  ROOT: '/',

  /**
   * 경로 구분자
   */
  SEPARATOR: '/',

  /**
   * 기본 노트 이름
   */
  DEFAULT_NOTE_NAME: '새 노트',

  /**
   * 기본 드로잉 이름
   */
  DEFAULT_DRAW_NAME: '새 드로잉',
} as const;

// 타입 추출
export type PathConstant = (typeof PATH_CONSTANTS)[keyof typeof PATH_CONSTANTS];



