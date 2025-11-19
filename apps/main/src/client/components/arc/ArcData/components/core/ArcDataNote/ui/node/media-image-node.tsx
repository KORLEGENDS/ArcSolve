'use client';


import type { TImageElement } from 'platejs';
import type { PlateElementProps } from 'platejs/react';

import { useDraggable } from '@platejs/dnd';
import { ImagePlugin, useMediaState } from '@platejs/media/react';
import { ResizableProvider, useResizableValue } from '@platejs/resizable';
import { PlateElement, withHOC } from 'platejs/react';

import { cn } from '@/share/share-utils/cn-utils';

import { Caption, CaptionTextarea } from '../caption';
import {
  mediaResizeHandleVariants,
  Resizable,
  ResizeHandle,
} from '../resize-handle';
import { MediaToolbar } from '../toolbar/media-toolbar';

export const ImageElement = withHOC(
  ResizableProvider,
  function ImageElement(props: PlateElementProps<TImageElement>) {
    const mediaState = useMediaState() as any;
    const {
      align = 'center',
      focused,
      readOnly,
      selected,
    } = mediaState as {
      align?: 'left' | 'center' | 'right';
      focused?: boolean;
      readOnly?: boolean;
      selected?: boolean;
    };

    // Plate 이미지 노드에 저장된 URL을 우선 사용하고,
    // 필요시 mediaState의 unsafeUrl/url을 보조적으로 사용합니다.
    const url =
      (props.element as any).url ??
      (props.element as any).unsafeUrl ??
      (mediaState?.unsafeUrl as string | undefined) ??
      (mediaState?.url as string | undefined);


    if (!url) {
      return null;
    }

    const width = useResizableValue('width');

    const { isDragging, handleRef } = useDraggable({
      element: props.element,
    });

    return (
      <MediaToolbar plugin={ImagePlugin}>
        <PlateElement {...props} className="py-2.5">
          <figure className="group relative m-0" contentEditable={false}>
            <Resizable
              align={align}
              options={{
                align,
                readOnly,
              }}
            >
              <ResizeHandle
                className={mediaResizeHandleVariants({ direction: 'left' })}
                options={{ direction: 'left' }}
              />
              <img
                ref={handleRef}
                className={cn(
                  'block w-full max-w-full cursor-pointer object-cover px-0',
                  'rounded-sm',
                  focused && selected && 'ring-2 ring-ring ring-offset-2',
                  isDragging && 'opacity-50'
                )}
                alt={props.attributes.alt as string | undefined}
                src={url}
              />
              <ResizeHandle
                className={mediaResizeHandleVariants({
                  direction: 'right',
                })}
                options={{ direction: 'right' }}
              />
            </Resizable>

            <Caption style={{ width }} align={align}>
              <CaptionTextarea
                readOnly={readOnly}
                onFocus={(e) => {
                  e.preventDefault();
                }}
                placeholder="Write a caption..."
              />
            </Caption>
          </figure>

          {props.children}
        </PlateElement>
      </MediaToolbar>
    );
  }
);
