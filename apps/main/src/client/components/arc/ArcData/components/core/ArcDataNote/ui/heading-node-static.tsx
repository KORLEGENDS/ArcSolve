import * as React from 'react';

import type { RenderElementProps } from 'platejs';

import { type VariantProps, cva } from 'class-variance-authority';

const headingVariants = cva('relative mb-1', {
  variants: {
    variant: {
      h1: 'mt-[1.6em] pb-1 font-heading text-4xl font-bold',
      h2: 'mt-[1.4em] pb-px font-heading text-2xl font-semibold tracking-tight',
      h3: 'mt-[1em] pb-px font-heading text-xl font-semibold tracking-tight',
      h4: 'mt-[0.75em] font-heading text-lg font-semibold tracking-tight',
      h5: 'mt-[0.75em] text-lg font-semibold tracking-tight',
      h6: 'mt-[0.75em] text-base font-semibold tracking-tight',
    },
  },
});

export function HeadingElementStatic({
  variant = 'h1',
  ...props
}: RenderElementProps & VariantProps<typeof headingVariants>) {
  const Component = variant! as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
  return React.createElement(
    Component,
    {
      ...props.attributes,
      className: headingVariants({ variant }),
    },
    props.children
  );
}

export function H1ElementStatic(props: RenderElementProps) {
  return <HeadingElementStatic variant="h1" {...props} />;
}

export function H2ElementStatic(
  props: React.ComponentProps<typeof HeadingElementStatic>
) {
  return <HeadingElementStatic variant="h2" {...props} />;
}

export function H3ElementStatic(
  props: React.ComponentProps<typeof HeadingElementStatic>
) {
  return <HeadingElementStatic variant="h3" {...props} />;
}

export function H4ElementStatic(
  props: React.ComponentProps<typeof HeadingElementStatic>
) {
  return <HeadingElementStatic variant="h4" {...props} />;
}

export function H5ElementStatic(
  props: React.ComponentProps<typeof HeadingElementStatic>
) {
  return <HeadingElementStatic variant="h5" {...props} />;
}

export function H6ElementStatic(
  props: React.ComponentProps<typeof HeadingElementStatic>
) {
  return <HeadingElementStatic variant="h6" {...props} />;
}
