
import type { RenderElementProps } from 'platejs';

import { cn } from '@/share/share-utils/cn-utils';

export function CalloutElementStatic({
  children,
  className,
  ...props
}: RenderElementProps & { className?: string }) {
  return (
    <div
      {...props.attributes}
      className={cn('my-1 flex rounded-sm bg-muted p-4 pl-3', className)}
      style={{
        backgroundColor: props.element.backgroundColor as any,
      }}
    >
      <div className="flex w-full gap-2 rounded-md">
        <div
          className="size-6 text-[18px] select-none"
          style={{
            fontFamily:
              '"Apple Color Emoji", "Segoe UI Emoji", NotoColorEmoji, "Noto Color Emoji", "Segoe UI Symbol", "Android Emoji", EmojiSymbols',
          }}
        >
          <span data-plate-prevent-deserialization>
            {(props.element.icon as any) || '💡'}
          </span>
        </div>
        <div className="w-full">{children}</div>
      </div>
    </div>
  );
}
