import { ResizeOverlay, type ResizeSessionHandle } from '@/share/share-utils/resizeSession-share-utils';
import React from 'react';
import { MAX_SIDEBAR_WIDTH, MIN_SIDEBAR_WIDTH, toPx } from '../utils/dimension';

export interface UseSidebarResizeProps {
  /**
   * Direction of the resize handle
   * - 'left': Handle is on left side (for right-positioned panels)
   * - 'right': Handle is on right side (for left-positioned panels)
   */
  direction?: 'left' | 'right';

  /**
   * Current width of the panel
   */
  currentWidth: string;

  /**
   * Callback to update width when resizing
   */
  onResize: (width: string) => void;

  /**
   * Callback to toggle panel visibility
   */
  onToggle?: () => void;

  /**
   * Whether the panel is currently collapsed
   */
  isCollapsed?: boolean;

  /**
   * Minimum resize width
   */
  minResizeWidth?: string;

  /**
   * Maximum resize width
   */
  maxResizeWidth?: string;

  /**
   * Whether to enable drag functionality
   */
  enableDrag?: boolean;

  /**
   * Callback to update dragging rail state
   */
  setIsDraggingRail?: (isDragging: boolean) => void;

  /**
   * Cookie name for persisting width
   */
  widthCookieName?: string;

  /**
   * Cookie max age in seconds
   */
  widthCookieMaxAge?: number;
}

export interface UseSidebarResizeReturn {
  dragRef: React.RefObject<HTMLButtonElement | null>;
  isDragging: React.MutableRefObject<boolean>;
  handlePointerDown: (e: React.PointerEvent) => void;
}

interface WidthUnit {
  value: number;
  unit: 'rem' | 'px';
}

function parseWidth(width: string): WidthUnit {
  const unit = width.endsWith('rem') ? 'rem' : 'px';
  const value = Number.parseFloat(width);
  return { value, unit };
}

function formatWidth(value: number, unit: 'rem' | 'px'): string {
  return `${unit === 'rem' ? value.toFixed(1) : Math.round(value)}${unit}`;
}

const AUTO_COLLAPSE_THRESHOLD = 1.5; // collapse when <= min * 1.5 (beyond min)
const EXPAND_THRESHOLD = 0.2; // distance ratio relative to min to expand

export function useSidebarResize({
  direction = 'right',
  currentWidth,
  onResize,
  onToggle,
  isCollapsed = false,
  minResizeWidth = MIN_SIDEBAR_WIDTH,
  maxResizeWidth = MAX_SIDEBAR_WIDTH,
  enableDrag = true,
  setIsDraggingRail = (_isDragging: boolean): void => { void _isDragging; },
  widthCookieName,
  widthCookieMaxAge = 60 * 60 * 24 * 7,
}: UseSidebarResizeProps): UseSidebarResizeReturn {
  const dragRef = React.useRef<HTMLButtonElement>(null);
  const sessionRef = React.useRef<ResizeSessionHandle | null>(null);
  const pointerIdRef = React.useRef<number | null>(null);
  const startWidth = React.useRef(0);
  const startX = React.useRef(0);
  const isDragging = React.useRef(false);
  const isInteractingWithRail = React.useRef(false);

  const onResizeRef = React.useRef(onResize);
  const onToggleRef = React.useRef(onToggle);
  const isCollapsedRef = React.useRef(isCollapsed);
  React.useEffect(() => { onResizeRef.current = onResize; }, [onResize]);
  React.useEffect(() => { onToggleRef.current = onToggle; }, [onToggle]);
  React.useEffect(() => { isCollapsedRef.current = isCollapsed; }, [isCollapsed]);

  const minWidthPx = React.useMemo(() => toPx(minResizeWidth), [minResizeWidth]);
  const maxWidthPx = React.useMemo(() => toPx(maxResizeWidth), [maxResizeWidth]);

  const isIncreasingWidth = React.useCallback(
    (currentX: number, referenceX: number): boolean => {
      return direction === 'left' ? currentX < referenceX : currentX > referenceX;
    },
    [direction]
  );

  const calculateWidth = React.useCallback(
    (e: MouseEvent): number => {
      if (direction === 'left') {
        return window.innerWidth - e.clientX;
      }
      return e.clientX;
    },
    [direction]
  );

  const persistWidth = React.useCallback(
    (width: string) => {
      if (widthCookieName) {
        document.cookie = `${widthCookieName}=${width}; path=/; max-age=${widthCookieMaxAge}`;
      }
    },
    [widthCookieName, widthCookieMaxAge]
  );

  const handlePointerMove = React.useCallback(
    (e: PointerEvent) => {
      if (!isInteractingWithRail.current) return;

      const deltaX = Math.abs(e.clientX - startX.current);
      if (!isDragging.current && deltaX > 5) {
        isDragging.current = true;
        setIsDraggingRail(true);
      }

      if (isDragging.current) {
        const { unit } = parseWidth(currentWidth);

        const currentDragDirection = isIncreasingWidth(
          e.clientX,
          startX.current
        )
          ? 'expand'
          : 'collapse';

        if (onToggleRef.current && !isCollapsedRef.current) {
          const currentDragWidth = calculateWidth(e);

          let shouldCollapse = false;
          if (AUTO_COLLAPSE_THRESHOLD <= 1.0) {
            shouldCollapse = currentDragWidth <= minWidthPx * AUTO_COLLAPSE_THRESHOLD;
          } else {
            if (currentDragWidth <= minWidthPx) {
              const extraDragNeeded = minWidthPx * (AUTO_COLLAPSE_THRESHOLD - 1.0);
              const distanceBeyondMin = minWidthPx - currentDragWidth;
              shouldCollapse = distanceBeyondMin >= extraDragNeeded;
            }
          }

          if (currentDragDirection === 'collapse' && shouldCollapse) {
            onToggleRef.current?.();
            startX.current = e.clientX; // reset toggle reference point
            return;
          }
        }

        if (
          onToggleRef.current &&
          isCollapsedRef.current &&
          currentDragDirection === 'expand' &&
          Math.abs(e.clientX - startX.current) > minWidthPx * EXPAND_THRESHOLD
        ) {
          onToggleRef.current?.();

          const initialWidth = calculateWidth(e);

          const clampedWidth = Math.max(
            minWidthPx,
            Math.min(maxWidthPx, initialWidth)
          );

          const formattedWidth = formatWidth(
            unit === 'rem' ? clampedWidth / 16 : clampedWidth,
            unit
          );
          onResizeRef.current?.(formattedWidth);
          persistWidth(formattedWidth);

          startX.current = e.clientX; // reset toggle reference point
          return;
        }

        if (isCollapsedRef.current) {
          return;
        }

        const newWidthPx = calculateWidth(e);

        const clampedWidthPx = Math.max(
          minWidthPx,
          Math.min(maxWidthPx, newWidthPx)
        );

        const newWidth = unit === 'rem' ? clampedWidthPx / 16 : clampedWidthPx;
        const formattedWidth = formatWidth(newWidth, unit);
        onResizeRef.current?.(formattedWidth);
        persistWidth(formattedWidth);
      }
    },
    [
      currentWidth,
      isIncreasingWidth,
      calculateWidth,
      minWidthPx,
      maxWidthPx,
      onResizeRef,
      onToggleRef,
      isCollapsedRef,
      persistWidth,
      setIsDraggingRail,
    ]
  );

  const finalize = React.useCallback(
    (kind: 'end' | 'cancel') => {
      if (!isInteractingWithRail.current) return;

      if (kind === 'end') {
        if (!isDragging.current && onToggleRef.current) {
          onToggleRef.current?.();
        }
      }

      if (pointerIdRef.current != null) {
        try {
          dragRef.current?.releasePointerCapture(pointerIdRef.current);
        } catch {}
      }
      pointerIdRef.current = null;

      isDragging.current = false;
      isInteractingWithRail.current = false;
      setIsDraggingRail(false);
      sessionRef.current = null;
    },
    [onToggleRef, setIsDraggingRail]
  );

  const handlePointerDown = React.useCallback(
    (e: React.PointerEvent) => {
      isInteractingWithRail.current = true;

      if (!enableDrag) {
        return;
      }

      const currentWidthPx = isCollapsed ? 0 : toPx(currentWidth);
      startWidth.current = currentWidthPx;
      startX.current = e.clientX;

      // Set pointer capture to keep events delivered to the rail element
      pointerIdRef.current = e.pointerId ?? null;
      try {
        if (pointerIdRef.current != null) {
          dragRef.current?.setPointerCapture(pointerIdRef.current);
        }
      } catch {}

      if (sessionRef.current?.active) {
        sessionRef.current.cancel();
      }

      sessionRef.current = ResizeOverlay.start({
        cursor: 'ew-resize',
        rootClassName: 'sidebar-resizing',
        onMove: handlePointerMove,
        onEnd: () => finalize('end'),
        onCancel: () => finalize('cancel'),
      });

      e.preventDefault();
    },
    [enableDrag, isCollapsed, currentWidth, handlePointerMove, finalize]
  );

  return {
    dragRef,
    isDragging,
    handlePointerDown,
  };
}

