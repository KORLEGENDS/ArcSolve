import * as React from 'react';

import type { RenderElementProps, TMentionElement } from 'platejs';

import { KEYS } from 'platejs';

import { cn } from '@/share/share-utils/cn-utils';

export function MentionElementStatic(
  props: RenderElementProps<TMentionElement> & {
    prefix?: string;
  }
) {
  const { prefix } = props;
  const element = props.element;

  return (
    <span
      {...props.attributes}
      className={cn(
        'inline-block rounded-md bg-muted px-1.5 py-0.5 align-baseline text-sm font-medium',
        element.children[0][KEYS.bold] === true && 'font-bold',
        element.children[0][KEYS.italic] === true && 'italic',
        element.children[0][KEYS.underline] === true && 'underline'
      )}
      data-slate-value={element.value}
    >
      <React.Fragment>
        {props.children}
        {prefix}
        {element.value}
      </React.Fragment>
    </span>
  );
}
