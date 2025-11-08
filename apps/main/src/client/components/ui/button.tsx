import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '@/client/components/ui/utils';

const buttonVariants = cva(
  "focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-all outline-none focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50 cursor-pointer [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        ghost:
          'bg-neutral text-neutral-foreground hover:bg-neutral/80 active:bg-neutral/60',
        point:
          'bg-accent text-accent-foreground hover:bg-accent/90 active:bg-accent/80 shadow-xs',
        brand:
          'bg-brand text-brand-foreground hover:bg-brand/90 active:bg-brand/80 shadow-xs',
      },
      layout: {
        default: '',
        icon: 'rounded-full p-0',
        item: 'grid grid-cols-[auto_1fr_auto] items-center gap-3 w-full my-1 px-3 py-2 rounded-md justify-start whitespace-normal [&>*:nth-child(1)]:shrink-0 [&>*:nth-child(2)]:min-w-0 [&>*:nth-child(2)]:truncate [&>*:nth-child(3)]:shrink-0 [&>*:nth-child(3)]:ml-auto',
      },
      size: {
        default: 'h-9 px-4 py-2 has-[>svg]:px-3',
        sm: 'h-8 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5',
        lg: 'h-10 rounded-md px-6 has-[>svg]:px-4',
        icon: 'size-9',
      },
    },
    defaultVariants: {
      variant: 'ghost',
      layout: 'default',
      size: 'default',
    },
  }
);

function Button({
  className,
  variant,
  layout,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : 'button';

  return (
    <Comp
      data-slot='button'
      className={cn(buttonVariants({ variant, layout, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
