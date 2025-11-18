import { BaseTogglePlugin } from '@platejs/toggle';

import { ToggleElementStatic } from '../../ui/static/toggle-node-static';

export const BaseToggleKit = [
  BaseTogglePlugin.withComponent(ToggleElementStatic),
];
