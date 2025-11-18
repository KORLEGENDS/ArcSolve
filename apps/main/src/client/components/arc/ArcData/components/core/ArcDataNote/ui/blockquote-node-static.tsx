import * as React from 'react';

import type { RenderElementProps } from 'platejs';

export function BlockquoteElementStatic(props: RenderElementProps) {
  return (
    <blockquote
      {...props.attributes}
      className="my-1 border-l-2 pl-6 italic"
    >
      {props.children}
    </blockquote>
  );
}
