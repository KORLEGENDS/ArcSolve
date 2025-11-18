import { BaseCalloutPlugin } from '@platejs/callout';

import { CalloutElementStatic } from '@/client/components/ui/callout-node-static';

export const BaseCalloutKit = [
  BaseCalloutPlugin.withComponent(CalloutElementStatic),
];
