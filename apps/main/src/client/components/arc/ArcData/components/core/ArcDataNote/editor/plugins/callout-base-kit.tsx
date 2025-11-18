import { BaseCalloutPlugin } from '@platejs/callout';

import { CalloutElementStatic } from '../../ui/static/callout-node-static';

export const BaseCalloutKit = [
  BaseCalloutPlugin.withComponent(CalloutElementStatic),
];
