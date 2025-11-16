'use client';

/**
 * 미디어 리소스 관리 싱글톤 (오디오/비디오)
 * - 다운로드(blob) 또는 스트리밍(url) 경로를 단일 API로 관리
 * - object URL 생성/해제, 진행중 작업 취소, LRU 캐시/타임아웃 정리
 */

export type MediaKey = string;
export type LoadMode = 'blob' | 'stream';

export interface LoadOptions {
  mode: LoadMode;
  mimeType?: string;
  headers?: Record<string, string>;
  onProgress?: (loaded: number, total: number | null) => void;
  signal?: AbortSignal;
}

export interface LoadedMedia {
  key: MediaKey;
  src: string; // blob: 또는 http/https URL
  mimeType?: string;
  mode: LoadMode;
}

interface CachedMedia {
  objectUrl?: string; // mode === 'blob'에서만 설정
  blobSize?: number;
  mimeType?: string;
  refCount: number;
  lastAccessed: number;
  mode: LoadMode;
}

export class PlayerManager {
  private static instance: PlayerManager;

  private mediaCache = new Map<MediaKey, CachedMedia>();
  private loadingTasks = new Map<
    MediaKey,
    { controller: AbortController; promise: Promise<Blob> }
  >();

  private readonly MAX_CACHE_SIZE = 10;
  private readonly CACHE_TIMEOUT_MS = 60_000; // 1분
  private readonly MAX_CACHE_AGE_MS = 5 * 60_000; // 5분

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private constructor() {}

  static getInstance(): PlayerManager {
    if (!PlayerManager.instance) {
      PlayerManager.instance = new PlayerManager();
    }
    return PlayerManager.instance;
  }

  /**
   * 미디어 로드
   * - mode='blob': url(문자열) 또는 Blob/ArrayBuffer를 받아 object URL을 생성하여 반환
   * - mode='stream': 원본 url 문자열을 그대로 반환(캐시 비보관)
   */
  async load(
    key: MediaKey,
    input: string | Blob | ArrayBuffer,
    options: LoadOptions,
  ): Promise<LoadedMedia> {
    const mode: LoadMode = options.mode;

    // stream 모드: 캐시 없이 즉시 반환
    if (mode === 'stream') {
      if (typeof input !== 'string') {
        throw new Error('stream 모드에서는 입력이 URL(string)이어야 합니다');
      }
      return { key, src: input, mimeType: options.mimeType, mode };
    }

    // blob 모드
    const cached = this.mediaCache.get(key);
    if (cached && cached.mode === 'blob' && typeof cached.objectUrl === 'string') {
      cached.refCount++;
      cached.lastAccessed = Date.now();
      return { key, src: cached.objectUrl, mimeType: cached.mimeType, mode };
    }

    // 진행중 작업 공유
    const existing = this.loadingTasks.get(key)?.promise;
    let blobPromise: Promise<Blob>;
    if (existing) {
      blobPromise = existing;
    } else {
      const controller = new AbortController();
      const signal = this.mergeSignals(controller.signal, options.signal);
      blobPromise = this.loadBlob(input, {
        headers: options.headers,
        onProgress: options.onProgress,
        signal,
        mimeType: options.mimeType,
      });
      this.loadingTasks.set(key, { controller, promise: blobPromise });
    }

    try {
      const blob = await blobPromise;
      const objectUrl = URL.createObjectURL(blob);

      this.mediaCache.set(key, {
        objectUrl,
        blobSize: blob.size,
        mimeType: options.mimeType ?? blob.type,
        refCount: 1,
        lastAccessed: Date.now(),
        mode: 'blob',
      });

      this.cleanupOld();

      return {
        key,
        src: objectUrl,
        mimeType: options.mimeType ?? blob.type,
        mode: 'blob',
      };
    } finally {
      this.loadingTasks.delete(key);
    }
  }

  /**
   * 진행중 로드 취소
   */
  cancelLoad(key: MediaKey): void {
    const task = this.loadingTasks.get(key);
    if (task) {
      try {
        task.controller.abort();
      } catch {
        // ignore
      }
      this.loadingTasks.delete(key);
    }
  }

  /**
   * 참조 해제: refCount 0이면 지연 후 object URL revoke 및 캐시 제거
   */
  release(key: MediaKey): void {
    const cached = this.mediaCache.get(key);
    if (!cached) return;
    cached.refCount -= 1;
    if (cached.refCount <= 0) {
      setTimeout(() => {
        const current = this.mediaCache.get(key);
        if (current && current.refCount <= 0) {
          if (current.objectUrl) {
            try {
              URL.revokeObjectURL(current.objectUrl);
            } catch {
              // ignore
            }
          }
          this.mediaCache.delete(key);
        }
      }, this.CACHE_TIMEOUT_MS);
    }
  }

  /**
   * 전체 캐시 정리
   */
  clearCache(): void {
    // 진행 작업 취소
    for (const [key, task] of this.loadingTasks.entries()) {
      try {
        task.controller.abort();
      } catch {
        // ignore
      }
      this.loadingTasks.delete(key);
    }

    // object URL revoke + 캐시 삭제
    for (const [key, cached] of this.mediaCache.entries()) {
      if (cached.objectUrl) {
        try {
          URL.revokeObjectURL(cached.objectUrl);
        } catch {
          // ignore
        }
      }
      this.mediaCache.delete(key);
    }
  }

  private async loadBlob(
    input: string | Blob | ArrayBuffer,
    opts: {
      headers?: Record<string, string>;
      onProgress?: (loaded: number, total: number | null) => void;
      signal?: AbortSignal;
      mimeType?: string;
    },
  ): Promise<Blob> {
    if (typeof input === 'string') {
      const res = await fetch(input, { headers: opts.headers, signal: opts.signal });
      if (!res.ok) {
        throw new Error(`미디어 다운로드 실패: ${res.status}`);
      }

      const totalHeader = res.headers.get('content-length');
      const total = totalHeader ? Number(totalHeader) || null : null;

      const body = res.body as ReadableStream<Uint8Array> | null;
      if (!body || typeof (body as any).getReader !== 'function') {
        return await res.blob();
      }

      const reader = body.getReader();
      const chunks: ArrayBuffer[] = [];
      let loaded = 0;

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          const ab = value.buffer.slice(
            value.byteOffset,
            value.byteOffset + value.byteLength,
          );
          chunks.push(ab);
          loaded += value.byteLength;
          opts.onProgress?.(loaded, total);
        }
      }

      const blob = new Blob(chunks, {
        type: opts.mimeType ?? res.headers.get('content-type') ?? 'application/octet-stream',
      });
      return blob;
    }

    if (input instanceof ArrayBuffer) {
      return new Blob([new Uint8Array(input)], {
        type: opts.mimeType ?? 'application/octet-stream',
      });
    }

    // Blob
    return input as Blob;
  }

  private cleanupOld(): void {
    const now = Date.now();
    const entries = Array.from(this.mediaCache.entries());

    // 오래된 항목 제거 (refCount == 0 && lastAccessed 경과)
    for (const [key, value] of entries) {
      if (value.refCount === 0 && now - value.lastAccessed > this.MAX_CACHE_AGE_MS) {
        if (value.objectUrl) {
          try {
            URL.revokeObjectURL(value.objectUrl);
          } catch {
            // ignore
          }
        }
        this.mediaCache.delete(key);
      }
    }

    // LRU: refCount == 0 대상으로 사이즈 제한
    if (this.mediaCache.size > this.MAX_CACHE_SIZE) {
      const zeroRef = entries
        .filter(([, v]) => v.refCount === 0)
        .sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);

      const removeCount = Math.max(0, this.mediaCache.size - this.MAX_CACHE_SIZE);
      for (let i = 0; i < removeCount && i < zeroRef.length; i += 1) {
        const [key, value] = zeroRef[i];
        if (value.objectUrl) {
          try {
            URL.revokeObjectURL(value.objectUrl);
          } catch {
            // ignore
          }
        }
        this.mediaCache.delete(key);
      }
    }
  }

  private mergeSignals(a: AbortSignal, b?: AbortSignal): AbortSignal {
    if (!b) return a;

    const controller = new AbortController();

    const onAbort = (): void => {
      controller.abort();
    };

    if (a.aborted || b.aborted) {
      controller.abort();
      return controller.signal;
    }

    a.addEventListener('abort', onAbort);
    b.addEventListener('abort', onAbort);

    return controller.signal;
  }
}

export const playerManager = PlayerManager.getInstance();


