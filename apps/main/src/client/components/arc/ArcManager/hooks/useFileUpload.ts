import { createUploadToast } from '@/client/components/ui/upload-toast';
import { useDocument } from '@/client/states/queries/document/useDocument';
import { queryKeyUtils } from '@/share/libs/react-query/query-keys';
import { allowedDocumentFileMimeTypes } from '@/share/schema/zod/document-upload-zod';
import { useQueryClient } from '@tanstack/react-query';
import * as React from 'react';

export function useFileUpload(parentPath: string) {
  const documentHook = useDocument();
  const queryClient = useQueryClient();
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleUploadClick = React.useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const uploadFile = React.useCallback(
    async (file: File) => {
      const filename = file.name;
      const fileSize = file.size;
      const mimeType = file.type;

      // 허용된 MIME 타입 확인
      if (!allowedDocumentFileMimeTypes.includes(mimeType as any)) {
        throw new Error(
          `지원하지 않는 파일 형식입니다. 지원 형식: ${allowedDocumentFileMimeTypes.join(', ')}`
        );
      }

      // 업로드 토스트 생성
      const toast = createUploadToast({
        filename,
        stage: 'requesting',
        progress: 0,
        cancellable: false,
      });

      try {
        // 1. 업로드 요청
        toast.setProgress(10, 'requesting');
        const requestResponse = await documentHook.requestUpload({
          name: filename,
          parentPath,
          fileSize,
          mimeType: mimeType as any,
        });

        // 2. Presigned URL 발급
        toast.setProgress(20, 'uploading');
        const { uploadUrl, storageKey } = await documentHook.getPresignedUploadUrl({
          processId: requestResponse.processId,
        });

        // 3. 실제 파일 업로드 (진행률 추적)
        toast.setProgress(30, 'uploading');
        const xhr = new XMLHttpRequest();

        await new Promise<void>((resolve, reject) => {
          xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
              // 30% ~ 90% 범위에서 진행률 업데이트
              const uploadProgress = 30 + (e.loaded / e.total) * 60;
              toast.setProgress(Math.round(uploadProgress), 'uploading');
            }
          });

          xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve();
            } else {
              reject(new Error(`업로드 실패: ${xhr.status} ${xhr.statusText}`));
            }
          });

          xhr.addEventListener('error', () => {
            reject(new Error('파일 업로드 중 네트워크 오류가 발생했습니다.'));
          });

          xhr.addEventListener('abort', () => {
            reject(new Error('업로드가 취소되었습니다.'));
          });

          xhr.open('PUT', uploadUrl);
          xhr.setRequestHeader('Content-Type', mimeType);
          xhr.send(file);
        });

        // 4. 업로드 확인
        toast.setProgress(95, 'confirming');
        const confirmedDocument = await documentHook.confirmUpload({
          processId: requestResponse.processId,
        });

        // 5. 완료
        toast.setProgress(100, 'completed');
        toast.complete();

        // 6. 문서 관련 캐시 업데이트(단일 요소 패치)
        queryKeyUtils.updateDocumentCache(queryClient, {
          action: 'add',
          document: confirmedDocument,
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : '파일 업로드 중 오류가 발생했습니다.';
        toast.fail(errorMessage);
        console.error('파일 업로드 실패:', error);
      }
    },
    [documentHook, parentPath]
  );

  const handleFileChange = React.useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      // 각 파일에 대해 업로드 수행
      for (const file of Array.from(files)) {
        await uploadFile(file);
      }

      // 파일 선택 후 input 초기화 (같은 파일을 다시 선택할 수 있도록)
      e.target.value = '';
    },
    [uploadFile]
  );

  return {
    fileInputRef,
    handleUploadClick,
    handleFileChange,
  };
}

