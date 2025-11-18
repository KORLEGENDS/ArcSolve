import * as React from 'react';

import type { RenderLeafProps } from 'platejs';

export function CodeLeafStatic(props: RenderLeafProps) {
  return (
    <code
      {...props.attributes}
      className="rounded-md bg-muted px-[0.3em] py-[0.2em] font-mono text-sm whitespace-pre-wrap"
    >
      {props.children}
    </code>
  );
}
