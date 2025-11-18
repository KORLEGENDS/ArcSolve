
import type { RenderElementProps } from 'platejs';

import { cn } from '@/share/share-utils/cn-utils';

export function ParagraphElementStatic(props: RenderElementProps) {
  return (
    <p {...props.attributes} className={cn('m-0 px-0 py-1')}>
      {props.children}
    </p>
  );
}
