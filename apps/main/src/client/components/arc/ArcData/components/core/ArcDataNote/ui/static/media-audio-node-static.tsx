import * as React from 'react';

import type { RenderElementProps, TAudioElement } from 'platejs';


export function AudioElementStatic(props: RenderElementProps<TAudioElement>) {
  return (
    <div {...props.attributes} className="mb-1">
      <figure className="group relative cursor-default">
        <div className="h-16">
          <audio className="size-full" src={props.element.url} controls />
        </div>
      </figure>
      {props.children}
    </div>
  );
}
