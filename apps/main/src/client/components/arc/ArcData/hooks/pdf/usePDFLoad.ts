/**
 * PDF 문서 관리 훅
 * - PDF 문서 로딩/캐싱을 책임
 * - src 변경 시에만 재로드
 * - 모드나 페이지 변경과 무관하게 문서 유지
 */

import type { PDFDocumentProxy } from 'pdfjs-dist/types/src/display/api';
import { useEffect, useState } from 'react';
import { pdfManager } from '../../managers/ArcDataPDFManager';

interface PDFDocumentState {
  document: PDFDocumentProxy | null;
  isLoading: boolean;
  error: Error | null;
}

export const usePDFLoad = (src: string | null): PDFDocumentState => {
  const [state, setState] = useState<PDFDocumentState>({
    document: null,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    if (!src) {
      setState({ document: null, isLoading: false, error: null });
      return;
    }

    let cancelled = false;

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    const loadDocument = async (): Promise<void> => {
      try {
        const doc = await pdfManager.loadDocument(src);

        if (!cancelled) {
          setState({
            document: doc,
            isLoading: false,
            error: null,
          });
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            document: null,
            isLoading: false,
            error: error instanceof Error ? error : new Error('PDF 로드 실패'),
          });
        }
      }
    };

    void loadDocument();

    return (): void => {
      cancelled = true;
      // 문서 해제는 src 변경 시에만
      if (src) {
        pdfManager.releaseDocument(src);
      }
    };
  }, [src]); // ✅ 오직 src만!

  return state;
};
