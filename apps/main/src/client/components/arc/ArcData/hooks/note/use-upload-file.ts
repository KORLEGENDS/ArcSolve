import * as React from 'react';

import { toast } from 'sonner';

import { useDocumentUpload } from '@/client/states/queries/document/useDocument';
import { allowedDocumentFileMimeTypes } from '@/share/schema/zod/document-upload-zod';

export type UploadedFile = {
  /** 업로드가 완료된 document.documentId */
  documentId: string;
  /** 파일 이름 (document.name) */
  name: string;
  /** 파일 크기 (bytes) */
  size: number;
  /** MIME 타입 (document.mimeType) */
  type: string;
  /** 실제 렌더링/다운로드에 사용할 서명 URL */
  url: string;
};

interface UseUploadFileProps {
  /**
   * 업로드될 파일의 부모 ltree 경로
   * - '' = 루트
   * - 별도 값을 넘기지 않으면 기본적으로 루트에 파일 문서를 생성합니다.
   */
  parentPath?: string;
  onUploadComplete?: (file: UploadedFile) => void;
  onUploadError?: (error: unknown) => void;
}

/**
 * 파일 MIME 타입을 서버에서 허용하는 MIME 타입으로 매핑합니다.
 * - 현재는 image/png, image/jpeg 및 allowedDocumentFileMimeTypes에 포함된 타입만 지원합니다.
 */
function mapFileMimeType(
  inputType: string,
): (typeof allowedDocumentFileMimeTypes)[number] | null {
  const allowed = allowedDocumentFileMimeTypes as readonly string[];

  if (allowed.includes(inputType)) {
    return inputType as (typeof allowedDocumentFileMimeTypes)[number];
  }

  if (inputType.startsWith('image/')) {
    if (inputType === 'image/png') return 'image/png';
    if (inputType === 'image/jpeg') return 'image/jpeg';
  }

  // TODO: audio/video 등을 document 업로드 파이프라인으로 통합하려면
  // allowedDocumentFileMimeTypes를 확장하고 여기 매핑을 추가합니다.
  return null;
}

export function useUploadFile({
  parentPath = '',
  onUploadComplete,
  onUploadError,
}: UseUploadFileProps = {}) {

  const [uploadedFile, setUploadedFile] = React.useState<UploadedFile>();
  const [uploadingFile, setUploadingFile] = React.useState<File>();
  const [progress, setProgress] = React.useState<number>(0);
  const [isUploading, setIsUploading] = React.useState(false);

  const { requestUpload, getPresignedUploadUrl, confirmUpload } =
    useDocumentUpload();

  const uploadFile = React.useCallback(
    async (file: File) => {
      setIsUploading(true);
      setUploadingFile(file);
      setProgress(0);


      try {
        const mimeType = mapFileMimeType(
          file.type || 'application/octet-stream',
        );

        if (!mimeType) {
          toast.error('지원하지 않는 파일 형식입니다.');
          throw new Error(`Unsupported file type: ${file.type}`);
        }

        // 1) 업로드 프로세스 생성
        setProgress(10);
        const { processId, documentId } = await requestUpload({
          name: file.name,
          parentPath,
          fileSize: file.size,
          mimeType,
        });


        // 2) presigned URL 발급
        setProgress(30);
        const { uploadUrl } = await getPresignedUploadUrl({ processId });


        // 3) R2에 실제 파일 업로드
        setProgress(60);

        const putRes = await fetch(uploadUrl, {
          method: 'PUT',
          body: file,
          headers: {
            'Content-Type': file.type || 'application/octet-stream',
            'Content-Length': String(file.size),
          },
        });

        if (!putRes.ok) {
          throw new Error(
            `파일 업로드 실패: ${putRes.status} ${putRes.statusText}`,
          );
        }


        // 4) 업로드 완료 확인
        setProgress(80);
        const document = await confirmUpload({ processId });


        // 5) inline 렌더링용 다운로드 URL 발급
        setProgress(90);
        const params = new URLSearchParams();
        params.set('inline', '1');
        params.set('filename', document.name);

        const res = await fetch(
          `/api/document/${encodeURIComponent(
            document.documentId,
          )}/download-url?${params.toString()}`,
        );

        if (!res.ok) {
          throw new Error('다운로드 URL 발급에 실패했습니다.');
        }

        // 서버 응답은 ok() 래퍼로 감싸져 있을 수 있으므로 data 레벨을 우선 언래핑합니다.
        const rawJson = (await res.json()) as
          | { url: string; expiresAt: string }
          | { data?: { url: string; expiresAt: string }; meta?: unknown };

        const payload =
          'data' in rawJson && rawJson.data
            ? rawJson.data
            : (rawJson as { url: string; expiresAt: string });


        const next: UploadedFile = {
          documentId: document.documentId,
          name: document.name,
          size: document.fileSize ?? file.size,
          type: document.mimeType ?? mimeType,
          url: payload.url,
        };

        setUploadedFile(next);
        setProgress(100);
        onUploadComplete?.(next);

        return next;
      } catch (error) {
        toast.error('파일 업로드 실패');
        onUploadError?.(error);
        throw error;
      } finally {
        // UI에서 100% 상태를 잠깐 보여준 뒤 초기화
        setTimeout(() => {
          setIsUploading(false);
          setUploadingFile(undefined);
          setProgress(0);
        }, 300);
      }
    },
    [parentPath, requestUpload, getPresignedUploadUrl, confirmUpload, onUploadComplete, onUploadError],
  );

  return {
    uploadedFile,
    uploadingFile,
    progress,
    isUploading,
    uploadFile,
  };
}

