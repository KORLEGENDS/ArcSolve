'use client';

import { Button } from '@/client/components/ui/button';
import { Progress } from '@/client/components/ui/progress';
import { cn } from '@/client/components/ui/utils';
import { Loader2Icon } from 'lucide-react';
import * as React from 'react';
import { type ExternalToast, toast as sonnerToast } from 'sonner';

export type UploadStage = 'requesting' | 'uploading' | 'confirming' | 'completed';

export interface UploadToastOptions extends Omit<ExternalToast, 'duration'> {
  filename: string;
  progress?: number; // 0~100
  stage?: UploadStage;
  cancellable?: boolean;
  onCancel?: () => void;
  durationOnSuccess?: number; // 성공 시 자동 닫힘 시간(ms)
}

export interface UploadToastController {
  id: string | number;
  setProgress: (progress: number, stage?: UploadStage) => void;
  complete: (title?: string, opts?: ExternalToast) => void;
  fail: (title: string, opts?: ExternalToast) => void;
  dismiss: () => void;
}

const BASE_TOAST_CLASS = 'bg-card text-card-foreground rounded-lg shadow-sm';

function createId(): string {
  return `upload:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
}

function renderUploadDescription(
  opts: Required<Pick<UploadToastOptions, 'filename'>> &
    Pick<UploadToastOptions, 'progress' | 'stage' | 'cancellable' | 'onCancel'>
): React.ReactElement {
  const progressValue =
    typeof opts.progress === 'number' ? Math.max(0, Math.min(100, opts.progress)) : undefined;
  const stageLabel = (() => {
    switch (opts.stage) {
      case 'requesting':
        return '업로드 준비 중';
      case 'uploading':
        return '업로드 중';
      case 'confirming':
        return '처리 중';
      case 'completed':
        return '완료';
      default:
        return '업로드';
    }
  })();

  return (
    <div className='flex items-center gap-3'>
      <div className='min-w-0 flex-1'>
        <div className='text-muted-foreground text-xs'>
          {stageLabel}
          {typeof progressValue === 'number' && progressValue < 100
            ? ` · ${Math.round(progressValue)}%`
            : null}
        </div>
        <div className='mt-1'>
          <Progress value={typeof progressValue === 'number' ? progressValue : 0} />
        </div>
      </div>
      {opts.cancellable && opts.onCancel ? (
        <Button variant='ghost' size='sm' onClick={opts.onCancel}>
          취소
        </Button>
      ) : null}
    </div>
  );
}

export function createUploadToast(options: UploadToastOptions): UploadToastController {
  const id = createId();
  const { filename, durationOnSuccess = 1800, ...rest } = options;

  sonnerToast.message(filename, {
    id,
    duration: Infinity,
    description: renderUploadDescription({
      filename,
      progress: options.progress,
      stage: options.stage,
      cancellable: options.cancellable,
      onCancel: options.onCancel,
    }),
    icon: <Loader2Icon className='size-4 animate-spin' />,
    closeButton: options.cancellable ? false : undefined,
    className: cn(BASE_TOAST_CLASS, rest.className),
    ...rest,
  });

  return {
    id,
    setProgress(progress: number, stage?: UploadStage) {
      sonnerToast.message(filename, {
        id,
        duration: Infinity,
        description: renderUploadDescription({
          filename,
          progress,
          stage,
          cancellable: options.cancellable,
          onCancel: options.onCancel,
        }),
        icon: <Loader2Icon className='size-4 animate-spin' />,
        closeButton: options.cancellable ? false : undefined,
        className: cn(BASE_TOAST_CLASS, rest.className),
        ...rest,
      });
    },
    complete(title?: string, opts?: ExternalToast) {
      const msg = title ?? `${filename} 업로드 완료`;
      sonnerToast.success(msg, { id, duration: durationOnSuccess, ...rest, ...opts });
    },
    fail(title: string, opts?: ExternalToast) {
      sonnerToast.error(title, { id, ...rest, ...opts });
    },
    dismiss() {
      sonnerToast.dismiss(id);
    },
  };
}


