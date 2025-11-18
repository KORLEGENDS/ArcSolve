'use client';

import { TogglePlugin } from '@platejs/toggle/react';

import { IndentKit } from '@/client/components/arc/ArcData/components/core/ArcDataNote/editor/plugins/indent-kit';
import { ToggleElement } from '../../ui/node/toggle-node';

export const ToggleKit = [
  ...IndentKit,
  TogglePlugin.withComponent(ToggleElement),
];
