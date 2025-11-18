import * as React from 'react';

import type { RenderElementProps, TFileElement } from 'platejs';

import { FileUp } from 'lucide-react';

export function FileElementStatic(props: RenderElementProps<TFileElement>) {
  const { name, url } = props.element;

  return (
    <div {...props.attributes} className="my-px rounded-sm">
      <a
        className="group relative m-0 flex cursor-pointer items-center rounded px-0.5 py-[3px] hover:bg-muted"
        contentEditable={false}
        download={name}
        href={url}
        rel="noopener noreferrer"
        role="button"
        target="_blank"
      >
        <div className="flex items-center gap-1 p-1">
          <FileUp className="size-5" />
          <div>{name}</div>
        </div>
      </a>
      {props.children}
    </div>
  );
}
