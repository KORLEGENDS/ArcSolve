'use client';

/**
 * ArcData 공통 바이너리 다운로드/스트림 관리 싱글톤
 * - URL/Blob/ArrayBuffer를 받아 Blob으로 변환
 * - fetch + ReadableStream을 이용한 진행률(onProgress) 콜백 지원
 * - PlayerManager / PDFManager 등에서 공유 사용
 */

export type ArcDataSource = string | Blob | ArrayBuffer;

export interface ArcDataLoadOptions {
  headers?: Record<string, string>;
  onProgress?: (loaded: number, total: number | null) => void;
  signal?: AbortSignal;
  mimeType?: string;
}

export class ArcDataManager {
  private static instance: ArcDataManager;

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private constructor() {}

  static getInstance(): ArcDataManager {
    if (!ArcDataManager.instance) {
      ArcDataManager.instance = new ArcDataManager();
    }
    return ArcDataManager.instance;
  }

  /**
   * 공통 바이너리 로더
   * - string: fetch + 스트림 읽기 → Blob
   * - ArrayBuffer: 즉시 Blob 래핑
   * - Blob: 그대로 반환
   */
  async loadBlobFromSource(
    input: ArcDataSource,
    opts: ArcDataLoadOptions = {},
  ): Promise<Blob> {
    if (typeof input === 'string') {
      const res = await fetch(input, { headers: opts.headers, signal: opts.signal });
      if (!res.ok) {
        throw new Error(`데이터 다운로드 실패: ${res.status}`);
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
          const ab = new ArrayBuffer(value.byteLength);
          new Uint8Array(ab).set(value);
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
    return input;
  }
}

export const arcDataManager = ArcDataManager.getInstance();


