// 업로드 직후의 낙관적 미리보기 URL(objectURL)을 안전하게 관리하기 위한 유틸
// - ref-count: 다중 소비자 보호
// - 안전 revoke: 교체 확정 후, 모든 소비자 해제 시 메모리 정리
// - SSR 가드: 브라우저 환경에서만 동작
// 주의사항/의도:
// 1) 동일 fileId를 다중 뷰가 동시에 사용할 때도 안전합니다. 서버 다운로드 URL로 스왑된 뒤,
//    해당 <img>가 실제로 로드(onload)되었음을 확인한 후에만 낙관적 objectURL을 정리합니다.
// 2) SSR 안전화를 위해 서버 렌더 단계에서는 DOM API(URL.createObjectURL/revokeObjectURL)를 호출하지 않습니다.

interface CacheEntry {
  url: string;
  refCount: number;
  pendingDelete: boolean;
  createdAt: number;
}

class OptimisticMediaCache {
  private cache = new Map<string, CacheEntry>();
  private isBrowser: boolean =
    typeof window !== 'undefined' && typeof URL !== 'undefined' &&
    typeof URL.createObjectURL === 'function' &&
    typeof URL.revokeObjectURL === 'function';

  public get(fileId: string): string | undefined {
    const entry = this.cache.get(fileId);
    return entry?.url;
  }

  // 기존 set(url)을 대체: File로부터 안전하게 생성·저장
  public setFromFile(fileId: string, file: File): string | undefined {
    if (!this.isBrowser) return undefined;
    const existing = this.cache.get(fileId);
    if (existing) return existing.url;
    let objectUrl: string | undefined;
    try {
      objectUrl = URL.createObjectURL(file);
    } catch {
      // noop: 브라우저 구현 차이로 createObjectURL 실패 가능
      objectUrl = undefined;
    }
    if (!objectUrl) return undefined;
    this.cache.set(fileId, {
      url: objectUrl,
      refCount: 0,
      pendingDelete: false,
      createdAt: Date.now(),
    });
    return objectUrl;
  }

  public acquire(fileId: string): string | undefined {
    const entry = this.cache.get(fileId);
    if (!entry) return undefined;
    entry.refCount += 1;
    return entry.url;
  }

  public release(fileId: string): void {
    const entry = this.cache.get(fileId);
    if (!entry) return;
    entry.refCount = Math.max(0, entry.refCount - 1);
    if (entry.refCount === 0 && entry.pendingDelete) {
      this.delete(fileId);
    }
  }

  // 서버 URL 로 전환이 확인되었음을 표시. 모든 소비자가 해제되면 안전 삭제
  public markSwapConfirmed(fileId: string): void {
    const entry = this.cache.get(fileId);
    if (!entry) return;
    entry.pendingDelete = true;
    if (entry.refCount === 0) {
      this.delete(fileId);
    }
  }

  public delete(fileId: string): void {
    const entry = this.cache.get(fileId);
    if (!entry) return;
    try {
      if (this.isBrowser) URL.revokeObjectURL(entry.url);
    } catch {
      // noop: 이미 해제된 URL이거나 브라우저 버그 방지
      void 0;
    }
    this.cache.delete(fileId);
  }

  public clear(): void {
    if (!this.cache.size) return;
    for (const [, entry] of this.cache) {
      try {
        if (this.isBrowser) URL.revokeObjectURL(entry.url);
      } catch {
        // noop: 이미 해제된 URL이거나 브라우저 버그 방지
        void 0;
      }
    }
    this.cache.clear();
  }

  // 간단한 통계
  public stats(): { entries: number } {
    return { entries: this.cache.size };
  }
}

export const optimisticMediaCache = new OptimisticMediaCache();

// 탭 종료 시 잔여 리소스 정리 (브라우저 환경에서만)
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    try {
      optimisticMediaCache.clear();
    } catch {
      void 0;
    }
  });
}
