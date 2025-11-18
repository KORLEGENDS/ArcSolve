import * as React from 'react';

import type { RenderElementProps, TColumnElement } from 'platejs';

export function ColumnElementStatic(props: RenderElementProps<TColumnElement>) {
  const { width } = props.element;

  return (
    <div className="group/column relative" style={{ width: width ?? '100%' }}>
      <div
        {...props.attributes}
        className="h-full px-2 pt-2 group-first/column:pl-0 group-last/column:pr-0"
      >
        <div className="relative h-full border border-transparent p-1.5">
          {props.children}
        </div>
      </div>
    </div>
  );
}

export function ColumnGroupElementStatic(props: RenderElementProps) {
  return (
    <div {...props.attributes} className="mb-2">
      <div className="flex size-full rounded">{props.children}</div>
    </div>
  );
}
