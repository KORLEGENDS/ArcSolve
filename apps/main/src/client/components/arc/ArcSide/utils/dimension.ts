// Dimension utilities and constants for ArcSide layout

import {
  MAX_SIDEBAR_WIDTH,
  MIN_SIDEBAR_WIDTH,
} from '../ArcSide-config';

// Re-export for backward compatibility
export { MAX_SIDEBAR_WIDTH, MIN_SIDEBAR_WIDTH };

export function toPx(widthToken: string): number {
  const numeric = Number.parseFloat(widthToken);
  return widthToken.endsWith('rem') ? numeric * 16 : numeric;
}

export function isNarrowWidth(
  currentWidthToken: string,
  minWidthToken: string = MIN_SIDEBAR_WIDTH
): boolean {
  return toPx(currentWidthToken) < toPx(minWidthToken);
}

export function isCompactFrom(
  state: 'expanded' | 'collapsed',
  currentWidthToken: string,
  minWidthToken: string = MIN_SIDEBAR_WIDTH
): boolean {
  return (
    state === 'collapsed' || isNarrowWidth(currentWidthToken, minWidthToken)
  );
}
