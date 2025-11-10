'use client';

/**
 * CSS 클래스명 매퍼 타입
 */
export type ClassNameMapper = (defaultClassName: string) => string;

/**
 * 기본 클래스명 매퍼
 * CSS 모듈을 사용하거나 클래스명을 변환할 때 사용합니다
 */
export function defaultClassNameMapper(defaultClassName: string): string {
  return defaultClassName;
}

/**
 * 클래스명 매퍼 생성 함수
 */
export function createClassNameMapper(
  customMapper?: ClassNameMapper
): ClassNameMapper {
  return (defaultClassName: string) => {
    // 커스텀 매퍼가 있으면 사용
    if (customMapper) {
      return customMapper(defaultClassName);
    }

    // 기본 매퍼 실행
    return defaultClassNameMapper(defaultClassName);
  };
}

