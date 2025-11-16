'use client';

import { ArcManagerTree, type ArcManagerTreeItem } from '@/client/components/arc/ArcManager/components/tree';
import { Button } from '@/client/components/ui/button';
import { Input } from '@/client/components/ui/input';
import { createUploadToast } from '@/client/components/ui/upload-toast';
import { useDocument } from '@/client/states/queries/document/useDocument';
import { allowedDocumentFileMimeTypes } from '@/share/schema/zod/document-upload-zod';
import { Upload } from 'lucide-react';
import * as React from 'react';

export type ArcDataType = 'notes' | 'files' | 'chat';

export interface ArcDataProps {
  type: ArcDataType;
  className?: string;
}

/**
 * ArcData - 데이터 타입별 트리 뷰 컴포넌트
 * - 각 타입(notes/files/chat)에 맞는 훅을 사용하여 데이터를 가져와 렌더링
 * - 내부에서 자체적인 상태 관리
 */
export function ArcData({ type, className }: ArcDataProps) {
  const [searchQuery, setSearchQuery] = React.useState('');
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // 타입별 훅 사용
  // TODO: 각 타입에 맞는 리스트 조회 훅이 구현되면 연결
  const documentHook = useDocument(); // files 타입용 (현재는 업로드만 지원)

  // 타입별 데이터 변환 로직
  // TODO: 실제 데이터를 ArcManagerTreeItem[] 형태로 변환
  const treeItems: ArcManagerTreeItem[] = React.useMemo(() => {
    // 현재는 빈 배열 반환 (추후 각 타입별 훅에서 데이터를 가져와 변환)
    return [];
  }, [type]);

  const showUploadButton = type === 'files';

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
          parentPath: '/', // TODO: 현재 선택된 폴더 경로로 변경
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
        await documentHook.confirmUpload({
          processId: requestResponse.processId,
        });

        // 5. 완료
        toast.setProgress(100, 'completed');
        toast.complete();

        // 문서 목록 새로고침 (추후 구현)
        // await documentHook.invalidateDocument(requestResponse.documentId);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : '파일 업로드 중 오류가 발생했습니다.';
        toast.fail(errorMessage);
        console.error('파일 업로드 실패:', error);
      }
    },
    [documentHook]
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

  return (
    <div className={`flex flex-col h-full ${className || ''}`}>
      {/* Toolbar */}
      <div className="px-2 py-2">
        <div className="flex gap-2">
          <Input
            type="search"
            placeholder="검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1"
          />
          {showUploadButton && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFileChange}
                accept="*/*"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={handleUploadClick}
                title="파일 업로드"
              >
                <Upload className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto py-2">
        <ArcManagerTree items={treeItems} />
      </div>
    </div>
  );
}

