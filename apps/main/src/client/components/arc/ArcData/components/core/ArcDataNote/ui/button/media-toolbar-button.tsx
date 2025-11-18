'use client';

import * as React from 'react';

import type { DropdownMenuProps } from '@radix-ui/react-dropdown-menu';

import { PlaceholderPlugin } from '@platejs/media/react';
import {
    AudioLinesIcon,
    FileUpIcon,
    FilmIcon,
    ImageIcon,
    LinkIcon,
} from 'lucide-react';
import { isUrl, KEYS } from 'platejs';
import { useEditorRef } from 'platejs/react';
import { toast } from 'sonner';

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/client/components/ui/alert-dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/client/components/ui/dropdown-menu';
import { Input } from '@/client/components/ui/input';
import {
    ToolbarSplitButton,
    ToolbarSplitButtonPrimary,
    ToolbarSplitButtonSecondary,
} from '@/client/components/ui/toolbar';
import {
  ArcManagerDropZone,
  type ArcManagerDropItem,
} from '@/client/components/ui/custom/arcmanager-drop-zone';

const MEDIA_CONFIG: Record<
  string,
  {
    accept: string[];
    icon: React.ReactNode;
    title: string;
    tooltip: string;
  }
> = {
  [KEYS.audio]: {
    accept: ['audio/*'],
    icon: <AudioLinesIcon className="size-4" />,
    title: 'Insert Audio',
    tooltip: 'Audio',
  },
  [KEYS.file]: {
    accept: ['*'],
    icon: <FileUpIcon className="size-4" />,
    title: 'Insert File',
    tooltip: 'File',
  },
  [KEYS.img]: {
    accept: ['image/*'],
    icon: <ImageIcon className="size-4" />,
    title: 'Insert Image',
    tooltip: 'Image',
  },
  [KEYS.video]: {
    accept: ['video/*'],
    icon: <FilmIcon className="size-4" />,
    title: 'Insert Video',
    tooltip: 'Video',
  },
};

export function MediaToolbarButton({
  nodeType,
  ...props
}: DropdownMenuProps & { nodeType: string }) {
  const currentConfig = MEDIA_CONFIG[nodeType];

  const editor = useEditorRef();
  const [open, setOpen] = React.useState(false);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [arcManagerDialogOpen, setArcManagerDialogOpen] = React.useState(false);

  const handleUploadFromComputer = React.useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = currentConfig.accept.join(',');
    input.onchange = (event: Event) => {
      const target = event.target as HTMLInputElement | null;
      if (!target?.files) return;
      const files = Array.from(target.files);
      if (!files.length) return;
      editor.getTransforms(PlaceholderPlugin).insert.media(files);
    };
    input.click();
  }, [currentConfig.accept, editor]);

  const handleSelectFromArcManager = React.useCallback(
    (item: ArcManagerDropItem) => {
      // 1차 구현: 파일 문서에 대해 간단한 텍스트 블록으로 참조를 추가합니다.
      // 추후에는 arcdata-document 카드나 실제 미디어 embed로 확장할 수 있습니다.
      if (item.kind !== 'file') return;

      editor.tf.insertNodes({
        type: 'p',
        children: [
          {
            text: `[파일] ${item.name}`,
          },
        ],
  });

      setArcManagerDialogOpen(false);
    },
    [editor],
  );

  return (
    <>
      <ToolbarSplitButton
        onClick={() => {
          // 기본 클릭은 업로드 메뉴를 여는 대신, 드롭다운을 펼칩니다.
          setOpen((prev) => !prev);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setOpen(true);
          }
        }}
        pressed={open}
      >
        <ToolbarSplitButtonPrimary>
          {currentConfig.icon}
        </ToolbarSplitButtonPrimary>

        <DropdownMenu
          open={open}
          onOpenChange={setOpen}
          modal={false}
          {...props}
        >
          <DropdownMenuTrigger asChild>
            <ToolbarSplitButtonSecondary />
          </DropdownMenuTrigger>

          <DropdownMenuContent
            onClick={(e) => e.stopPropagation()}
            align="start"
            alignOffset={-32}
          >
            <DropdownMenuGroup>
              <DropdownMenuItem onSelect={() => handleUploadFromComputer()}>
                {currentConfig.icon}
                Upload from computer
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setDialogOpen(true)}>
                <LinkIcon />
                Insert via URL
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => {
                  setArcManagerDialogOpen(true);
                }}
              >
                <FileUpIcon className="mr-2 size-4" />
                Select from ArcManager
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </ToolbarSplitButton>

      <AlertDialog
        open={dialogOpen}
        onOpenChange={(value) => {
          setDialogOpen(value);
        }}
      >
        <AlertDialogContent className="gap-6">
          <MediaUrlDialogContent
            currentConfig={currentConfig}
            nodeType={nodeType}
            setOpen={setDialogOpen}
          />
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={arcManagerDialogOpen}
        onOpenChange={(value) => {
          setArcManagerDialogOpen(value);
        }}
      >
        <AlertDialogContent className="gap-4">
          <AlertDialogHeader>
            <AlertDialogTitle>ArcManager에서 파일 선택</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogDescription>
            ArcManager 파일 트리에서 문서를 드래그해 이 영역에 드롭하면, 노트에 간단한 파일 참조가 추가됩니다.
          </AlertDialogDescription>
          <ArcManagerDropZone
            allowedKinds={['file']}
            onSelect={handleSelectFromArcManager}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>닫기</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </>
  );
}

function MediaUrlDialogContent({
  currentConfig,
  nodeType,
  setOpen,
}: {
  currentConfig: (typeof MEDIA_CONFIG)[string];
  nodeType: string;
  setOpen: (value: boolean) => void;
}) {
  const editor = useEditorRef();
  const [url, setUrl] = React.useState('');

  const embedMedia = React.useCallback(() => {
    if (!isUrl(url)) return toast.error('Invalid URL');

    setOpen(false);
    editor.tf.insertNodes({
      children: [{ text: '' }],
      name: nodeType === KEYS.file ? url.split('/').pop() : undefined,
      type: nodeType,
      url,
    });
  }, [url, editor, nodeType, setOpen]);

  return (
    <>
      <AlertDialogHeader>
        <AlertDialogTitle>{currentConfig.title}</AlertDialogTitle>
      </AlertDialogHeader>

      <AlertDialogDescription className="group relative w-full">
        <label
          className="absolute top-1/2 block -translate-y-1/2 cursor-text px-1 text-sm text-muted-foreground/70 transition-all group-focus-within:pointer-events-none group-focus-within:top-0 group-focus-within:cursor-default group-focus-within:text-xs group-focus-within:font-medium group-focus-within:text-foreground has-[+input:not(:placeholder-shown)]:pointer-events-none has-[+input:not(:placeholder-shown)]:top-0 has-[+input:not(:placeholder-shown)]:cursor-default has-[+input:not(:placeholder-shown)]:text-xs has-[+input:not(:placeholder-shown)]:font-medium has-[+input:not(:placeholder-shown)]:text-foreground"
          htmlFor="url"
        >
          <span className="inline-flex bg-background px-2">URL</span>
        </label>
        <Input
          id="url"
          className="w-full"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') embedMedia();
          }}
          placeholder=""
          type="url"
          autoFocus
        />
      </AlertDialogDescription>

      <AlertDialogFooter>
        <AlertDialogCancel>Cancel</AlertDialogCancel>
        <AlertDialogAction
          onClick={(e) => {
            e.preventDefault();
            embedMedia();
          }}
        >
          Accept
        </AlertDialogAction>
      </AlertDialogFooter>
    </>
  );
}
