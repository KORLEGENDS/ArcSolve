
import type { TLinkElement } from 'platejs';
import type { SlateElementProps } from 'platejs/static';

import { getLinkAttributes } from '@platejs/link';

export function LinkElementStatic(props: SlateElementProps<TLinkElement>) {
  return (
    <a
      {...props.attributes}
      {...getLinkAttributes(props.editor, props.element)}
      className="font-medium text-primary underline decoration-primary underline-offset-4"
    >
      {props.children}
    </a>
  );
}
