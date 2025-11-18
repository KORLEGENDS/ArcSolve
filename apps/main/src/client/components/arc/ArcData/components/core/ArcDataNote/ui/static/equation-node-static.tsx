
import type { RenderElementProps, TEquationElement } from 'platejs';

import { getEquationHtml } from '@platejs/math';
import { RadicalIcon } from 'lucide-react';

import { cn } from '@/share/share-utils/cn-utils';

export function EquationElementStatic(
  props: RenderElementProps<TEquationElement>
) {
  const { element } = props;

  const html = getEquationHtml({
    element,
    options: {
      displayMode: true,
      errorColor: '#cc0000',
      fleqn: false,
      leqno: false,
      macros: { '\\f': '#1f(#2)' },
      output: 'htmlAndMathml',
      strict: 'warn',
      throwOnError: false,
      trust: false,
    },
  });

  return (
    <div {...props.attributes} className="my-1">
      <div
        className={cn(
          'group flex items-center justify-center rounded-sm select-none hover:bg-primary/10 data-[selected=true]:bg-primary/10',
          element.texExpression.length === 0 ? 'bg-muted p-3 pr-9' : 'px-2 py-1'
        )}
      >
        {element.texExpression.length > 0 ? (
          <span
            dangerouslySetInnerHTML={{
              __html: html,
            }}
          />
        ) : (
          <div className="flex h-7 w-full items-center gap-2 text-sm whitespace-nowrap text-muted-foreground">
            <RadicalIcon className="size-6 text-muted-foreground/80" />
            <div>Add a Tex equation</div>
          </div>
        )}
      </div>
      {props.children}
    </div>
  );
}

export function InlineEquationElementStatic(
  props: RenderElementProps<TEquationElement>
) {
  const html = getEquationHtml({
    element: props.element,
    options: {
      displayMode: true,
      errorColor: '#cc0000',
      fleqn: false,
      leqno: false,
      macros: { '\\f': '#1f(#2)' },
      output: 'htmlAndMathml',
      strict: 'warn',
      throwOnError: false,
      trust: false,
    },
  });

  return (
    <span
      {...props.attributes}
      className="inline-block rounded-sm select-none [&_.katex-display]:my-0"
    >
      <div
        className={cn(
          'after:absolute after:inset-0 after:-top-0.5 after:-left-1 after:z-1 after:h-[calc(100%)+4px] after:w-[calc(100%+8px)] after:rounded-sm after:content-[""]',
          'h-6',
          props.element.texExpression.length === 0 &&
            'text-muted-foreground after:bg-neutral-500/10'
        )}
      >
        <span
          className={cn(
            props.element.texExpression.length === 0 && 'hidden',
            'font-mono leading-none'
          )}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
      {props.children}
    </span>
  );
}
