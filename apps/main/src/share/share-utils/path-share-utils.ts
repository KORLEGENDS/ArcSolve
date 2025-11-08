/**
 * 경로 처리 유틸리티 함수
 * 노트, 파일 등의 경로를 처리하는 중앙화된 유틸리티
 */

import { PATH_CONSTANTS } from '@/share/configs/constants/path-constants';

/**
 * 경로를 정규화합니다
 * @param path - 정규화할 경로
 * @returns 정규화된 경로 (루트는 빈 문자열로)
 */
export function normalizePath(path: string): string {
  return path === PATH_CONSTANTS.ROOT ? '' : path;
}

/**
 * 부모 경로와 자식 이름을 결합하여 전체 경로를 생성합니다
 * @param parentPath - 부모 경로
 * @param childName - 자식 항목 이름
 * @returns 결합된 전체 경로
 */
export function joinPath(parentPath: string, childName: string): string {
  // 빈 자식 이름 처리
  if (!childName || childName.trim() === '') {
    return parentPath;
  }

  // 루트 경로 처리
  if (parentPath === PATH_CONSTANTS.ROOT) {
    return `${PATH_CONSTANTS.ROOT}${childName}`;
  }

  // 일반 경로 결합
  return `${parentPath}${PATH_CONSTANTS.SEPARATOR}${childName}`;
}

/**
 * 여러 경로 세그먼트를 결합합니다
 * @param segments - 결합할 경로 세그먼트들
 * @returns 결합된 경로
 */
export function joinPathSegments(...segments: string[]): string {
  const validSegments = segments.filter((s) => s && s.trim() !== '');

  if (validSegments.length === 0) {
    return PATH_CONSTANTS.ROOT;
  }

  // 첫 세그먼트가 루트인 경우
  if (validSegments[0] === PATH_CONSTANTS.ROOT) {
    if (validSegments.length === 1) {
      return PATH_CONSTANTS.ROOT;
    }
    return (
      PATH_CONSTANTS.ROOT +
      validSegments.slice(1).join(PATH_CONSTANTS.SEPARATOR)
    );
  }

  return validSegments.join(PATH_CONSTANTS.SEPARATOR);
}

/**
 * 경로의 깊이를 계산합니다
 * @param path - 깊이를 계산할 경로
 * @returns 경로의 깊이 (루트는 0)
 */
export function getPathDepth(path: string): number {
  if (path === PATH_CONSTANTS.ROOT) {
    return 0;
  }

  return path.split(PATH_CONSTANTS.SEPARATOR).filter(Boolean).length;
}

/**
 * 경로에서 부모 경로를 추출합니다
 * @param path - 부모 경로를 추출할 경로
 * @returns 부모 경로
 */
export function getParentPath(path: string): string {
  if (path === PATH_CONSTANTS.ROOT) {
    return PATH_CONSTANTS.ROOT;
  }

  const segments = path.split(PATH_CONSTANTS.SEPARATOR).filter(Boolean);

  if (segments.length <= 1) {
    return PATH_CONSTANTS.ROOT;
  }

  return (
    PATH_CONSTANTS.ROOT + segments.slice(0, -1).join(PATH_CONSTANTS.SEPARATOR)
  );
}

/**
 * 경로에서 마지막 세그먼트(파일/폴더 이름)를 추출합니다
 * @param path - 이름을 추출할 경로
 * @returns 마지막 세그먼트 이름
 */
export function getBaseName(path: string): string {
  if (path === PATH_CONSTANTS.ROOT) {
    return PATH_CONSTANTS.ROOT;
  }

  const segments = path.split(PATH_CONSTANTS.SEPARATOR).filter(Boolean);
  return segments[segments.length - 1] || PATH_CONSTANTS.ROOT;
}

/**
 * 경로가 유효한지 검증합니다
 * @param path - 검증할 경로
 * @returns 경로가 유효하면 true
 */
export function isValidPath(path: string): boolean {
  // 빈 경로는 유효하지 않음
  if (!path || path.trim() === '') {
    return false;
  }

  // 루트로 시작해야 함
  if (!path.startsWith(PATH_CONSTANTS.ROOT)) {
    return false;
  }

  // 연속된 슬래시는 허용하지 않음
  if (path.includes('//')) {
    return false;
  }

  return true;
}

/**
 * 경로가 루트 경로인지 확인합니다
 * @param path - 확인할 경로
 * @returns 루트 경로면 true
 */
export function isRootPath(path: string): boolean {
  return path === PATH_CONSTANTS.ROOT;
}

/**
 * 두 경로가 부모-자식 관계인지 확인합니다
 * @param parentPath - 부모 경로
 * @param childPath - 자식 경로
 * @returns 부모-자식 관계면 true
 */
export function isParentOf(parentPath: string, childPath: string): boolean {
  if (parentPath === childPath) {
    return false;
  }

  if (parentPath === PATH_CONSTANTS.ROOT) {
    return (
      childPath.startsWith(PATH_CONSTANTS.ROOT) &&
      childPath !== PATH_CONSTANTS.ROOT
    );
  }

  return childPath.startsWith(parentPath + PATH_CONSTANTS.SEPARATOR);
}

/**
 * 노트용 경로를 생성합니다 (기본값 처리 포함)
 * @param name - 노트/폴더 이름
 * @param parentPath - 부모 경로 (기본값: 루트)
 * @returns 생성된 노트 경로
 */
export function createNotePath(
  name: string,
  parentPath: string = PATH_CONSTANTS.ROOT
): string {
  const trimmedName = name.trim();
  if (!trimmedName) {
    throw new Error('노트 이름은 필수입니다');
  }

  return joinPath(parentPath, trimmedName);
}

/**
 * 절대 경로 문자열을 표준화합니다.
 * - 선행 슬래시 보장
 * - 말미 슬래시 제거(루트 제외)
 * - 중복 슬래시 정리
 */
export function normalizeAbsolutePath(input: string): string {
  let p = (input ?? '').trim();
  if (p === PATH_CONSTANTS.ROOT) return PATH_CONSTANTS.ROOT;
  if (!p.startsWith(PATH_CONSTANTS.ROOT)) p = `${PATH_CONSTANTS.ROOT}${p}`;
  if (p.length > 1 && p.endsWith(PATH_CONSTANTS.SEPARATOR)) {
    p = p.replace(/\/+$/g, '');
  }
  // 중복 슬래시 모두 단일화
  p = p.replace(/\/+?/g, '/');
  return p;
}

/**
 * 경로 배열에서 상위 경로만 남기고 하위 중복을 제거합니다.
 * 예: ['/a', '/a/b', '/c/d'] => ['/a', '/c/d']
 */
export function reduceToTopLevelPaths(paths: string[]): string[] {
  const sorted = [...paths]
    .filter((p) => typeof p === 'string' && p.length > 0)
    .map(normalizeAbsolutePath)
    .sort((a, b) => a.length - b.length);
  const picked: string[] = [];
  for (const p of sorted) {
    const covered = picked.some((q) => p === q || p.startsWith(q + PATH_CONSTANTS.SEPARATOR));
    if (!covered) picked.push(p);
  }
  return picked;
}
