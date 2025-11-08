'use client';

import type { ComponentType } from 'react';

import {
  type IconToken,
  iconFromToken as resolveIcon,
  resolveIconRendererWeb as resolveIconRenderer,
} from './index';

export const iconFromToken = resolveIcon;

export const iconComponentFromToken = (
  token: IconToken
): ComponentType<{ className?: string; size?: number | string; 'aria-hidden'?: boolean }> => {
  const renderer = resolveIconRenderer(token);
  const IconComponent = (props: { className?: string; size?: number | string; 'aria-hidden'?: boolean }) => {
    if (renderer) {
      return renderer(props);
    }
    return resolveIcon(token, props);
  };
  IconComponent.displayName = `IconToken(${token})`;
  return IconComponent;
};

export type { IconToken };
