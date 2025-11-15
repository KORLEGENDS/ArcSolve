/**
 * PDF 리소스 관리 싱글톤
 * PDF.js 워커 초기화, 문서 캐싱, 렌더링 작업 관리
 */

import * as pdfjsLib from 'pdfjs-dist';
import type {
  PDFDocumentProxy,
  RenderTask,
} from 'pdfjs-dist/types/src/display/api';

// ==================== 타입 정의 ====================

interface CachedDocument {
  document: PDFDocumentProxy;
  refCount: number;
  lastAccessed: number;
}

interface RenderOptions {
  eventId: string;
  document: PDFDocumentProxy;
  pageNumber: number;
  canvas: HTMLCanvasElement;
  scale: number;
  /** Optional max DPR cap for this render (e.g., thumbnails may use lower DPR) */
  maxDpr?: number;
}

// PageMetrics 및 measurePageMetrics는 더 이상 사용되지 않음

// ==================== PDF Manager 싱글톤 ====================

class PDFManager {
  private static instance: PDFManager;

  // 문서 캐시 (URL → PDF 문서)
  private documentCache = new Map<string, CachedDocument>();

  // 진행중인 로딩 작업
  private loadingPromises = new Map<string, Promise<PDFDocumentProxy>>();

  // 렌더링 작업 추적
  private renderTasks = new Map<string, RenderTask>();

  // 설정 상수
  private readonly MAX_CACHE_SIZE = 5;
  private readonly CACHE_TIMEOUT_MS = 60000; // 1분
  private readonly MAX_CACHE_AGE_MS = 5 * 60 * 1000; // 5분

  /**
   * Private constructor - 싱글톤 패턴
   * 워커 초기화 (한 번만)
   */
  private constructor() {
    if (
      typeof window !== 'undefined' &&
      !pdfjsLib.GlobalWorkerOptions.workerSrc
    ) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.mjs';
    }
  }

  /**
   * 싱글톤 인스턴스 획득
   */
  static getInstance(): PDFManager {
    if (!PDFManager.instance) {
      PDFManager.instance = new PDFManager();
    }
    return PDFManager.instance;
  }

  /**
   * 이벤트 ID prefix 규칙 통일: docKey → fingerprint → 'pdf'
   */
  getEventPrefix(docKey: string | undefined, document: PDFDocumentProxy): string {
    if (docKey && docKey.trim().length > 0) return docKey;
    const d = document as PDFDocumentProxy & { fingerprint?: string; fingerprints?: [string, string | null] };
    const fp = d?.fingerprint ?? d?.fingerprints?.[0];
    return fp ?? 'pdf';
  }

  /**
   * PDF 문서 로드 (캐싱 포함)
   * @param url PDF 파일 URL
   * @returns PDF 문서 객체
   */
  async loadDocument(url: string): Promise<PDFDocumentProxy> {
    // 1. 캐시 확인
    const cached = this.documentCache.get(url);
    if (cached) {
      cached.refCount++;
      cached.lastAccessed = Date.now();
      return cached.document;
    }

    // 2. 이미 로딩 중인지 확인 (중복 로딩 방지)
    const loading = this.loadingPromises.get(url);
    if (loading) {
      return loading;
    }

    // 3. 새로 로드
    const loadPromise = this.loadDocumentInternal(url);
    this.loadingPromises.set(url, loadPromise);

    try {
      const document = await loadPromise;

      // 캐시에 저장
      this.documentCache.set(url, {
        document,
        refCount: 1,
        lastAccessed: Date.now(),
      });

      // 메모리 관리: 오래된 문서 정리
      this.cleanupOldDocuments();

      return document;
    } finally {
      this.loadingPromises.delete(url);
    }
  }

  /**
   * 실제 PDF 로드 로직
   */
  private async loadDocumentInternal(url: string): Promise<PDFDocumentProxy> {
    const loadingTask = pdfjsLib.getDocument({
      url,
      // Prefer internal/wasm decoders for robustness with JPX+ICC
      useWasm: true,
      isImageDecoderSupported: false,
      isOffscreenCanvasSupported: false,
      // Be resilient to minor decode/parsing hiccups
      stopAtErrors: false,
      // Allow worker to fetch resources (default true on web, set explicitly for clarity)
      useWorkerFetch: true,
      // Wire public-served assets to avoid 404s like /nullopenjpeg.wasm and /null*.bcmap
      wasmUrl: '/pdfjs/wasm/',
      cMapUrl: '/pdfjs/cmaps/',
      cMapPacked: true,
      // Keep defaults for maxImageSize (-1) etc.
    });
    return (await loadingTask.promise) as PDFDocumentProxy;
  }

  /**
   * 문서 참조 해제
   * @param url PDF 파일 URL
   */
  releaseDocument(url: string): void {
    const cached = this.documentCache.get(url);
    if (cached) {
      cached.refCount--;

      // 참조가 0이 되면 일정 시간 후 정리
      if (cached.refCount === 0) {
        setTimeout(() => {
          const current = this.documentCache.get(url);
          if (current && current.refCount === 0) {
            void current.document.destroy();
            this.documentCache.delete(url);
          }
        }, this.CACHE_TIMEOUT_MS);
      }
    }
  }

  /**
   * 페이지 렌더링 (취소 관리 포함)
   */
  async renderPage(options: RenderOptions): Promise<void> {
    const { eventId, document, pageNumber, canvas, scale } = options;

    // 세션 선취소를 전제로 per-page 취소는 제거하여 단순화

    try {
      const page = await document.getPage(pageNumber);
      const viewport = page.getViewport({ scale });
      const context = canvas.getContext('2d');

      if (!context) {
        throw new Error('Canvas 2D context를 가져올 수 없습니다');
      }

      // 고해상도 디스플레이 지원
      const DPR_CAP = typeof options.maxDpr === 'number' ? options.maxDpr : 2; // 상한값: 옵션으로 오버라이드 가능
      const dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);

      // 캔버스 실제 픽셀 크기(정수)와 CSS 크기 분리
      const pixelWidth = Math.max(1, Math.floor(viewport.width * dpr));
      const pixelHeight = Math.max(1, Math.floor(viewport.height * dpr));
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;

      // 렌더링 시작: 공식 API 권장 형태로 canvas만 전달하고 DPR은 transform으로 적용
      const renderTask = page.render({
        canvas,
        viewport,
        transform: [dpr, 0, 0, dpr, 0, 0],
      });

      this.renderTasks.set(eventId, renderTask);
      await renderTask.promise;
    } catch (error) {
      // 취소된 작업은 에러로 처리하지 않음
      if ((error as Error).name !== 'RenderingCancelledException') {
        throw error;
      }
    } finally {
      this.renderTasks.delete(eventId);
    }
  }

  // measurePageMetrics 제거됨

  /**
   * 편의: 오프스크린 캔버스를 생성하여 지정 페이지를 렌더링 후 반환
   * - 이벤트 ID는 prefix:page 형식으로 부여되어 취소 정책과 일관성 유지
   */
  async renderToCanvas(params: {
    docKey?: string;
    document: PDFDocumentProxy;
    pageNumber: number;
    scale: number;
    maxDpr?: number;
  }): Promise<HTMLCanvasElement> {
    const { docKey, document, pageNumber, scale, maxDpr } = params;
    const offscreen = window.document.createElement('canvas');
    const prefix = this.getEventPrefix(docKey, document);
    const eventId = `${prefix}:${pageNumber}`;
    await this.renderPage({ eventId, document, pageNumber, canvas: offscreen, scale, maxDpr });
    return offscreen;
  }

  /**
   * 렌더링 작업 취소
   * @param eventId 취소할 작업 ID
   */
  cancelRender(eventId: string): void {
    const task = this.renderTasks.get(eventId);
    if (task) {
      task.cancel();
      this.renderTasks.delete(eventId);
    }
  }

  /**
   * 모든 렌더링 작업 취소
   */
  cancelAllRenders(): void {
    this.renderTasks.forEach((task) => task.cancel());
    this.renderTasks.clear();
  }

  /**
   * 특정 문서의 모든 렌더링 작업 취소
   */
  cancelDocumentRenders(urlPrefix: string): void {
    Array.from(this.renderTasks.entries())
      .filter(([eventId]) => eventId.startsWith(urlPrefix))
      .forEach(([eventId, task]) => {
        task.cancel();
        this.renderTasks.delete(eventId);
      });
  }

  /**
   * 오래된 문서 정리 (메모리 관리)
   */
  private cleanupOldDocuments(): void {
    const now = Date.now();

    // 1) 오래된(refCount=0 AND age>MAX_CACHE_AGE_MS) 항목 제거
    for (const [key, value] of Array.from(this.documentCache.entries())) {
      if (value.refCount === 0 && now - value.lastAccessed > this.MAX_CACHE_AGE_MS) {
        void value.document.destroy();
        this.documentCache.delete(key);
      }
    }

    // 2) LRU 정책으로 캐시 크기 제한 적용 (refCount=0만 대상으로 정렬)
    if (this.documentCache.size > this.MAX_CACHE_SIZE) {
      const candidates = Array.from(this.documentCache.entries())
        .filter(([_, v]) => v.refCount === 0)
        .sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);

      let needRemove = this.documentCache.size - this.MAX_CACHE_SIZE;
      for (let i = 0; i < candidates.length && needRemove > 0; i++) {
        const [key, value] = candidates[i];
        void value.document.destroy();
        this.documentCache.delete(key);
        needRemove--;
      }
    }
  }

  /**
   * 전체 캐시 초기화
   */
  clearCache(): void {
    // 모든 렌더링 작업 취소
    this.cancelAllRenders();

    // 모든 문서 정리
    this.documentCache.forEach(({ document }) => void document.destroy());
    this.documentCache.clear();

    // 로딩 작업 정리
    this.loadingPromises.clear();
  }
}

// Export singleton instance
export const pdfManager = PDFManager.getInstance();

// Export type for testing
export type { PDFManager };
