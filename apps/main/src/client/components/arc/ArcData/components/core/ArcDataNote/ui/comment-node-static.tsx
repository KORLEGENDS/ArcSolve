import * as React from 'react';

import type { RenderLeafProps, TCommentText } from 'platejs';

export function CommentLeafStatic(props: RenderLeafProps<TCommentText>) {
  return (
    <span
      {...props.attributes}
      className="border-b-2 border-b-highlight/35 bg-highlight/15"
    >
      {props.children}
    </span>
  );
}
