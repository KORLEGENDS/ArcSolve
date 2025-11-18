import * as React from 'react';

import type { RenderLeafProps } from 'platejs';

export function HighlightLeafStatic(props: RenderLeafProps) {
  return (
    <mark {...props.attributes} className="bg-highlight/30 text-inherit">
      {props.children}
    </mark>
  );
}
