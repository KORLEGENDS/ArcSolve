import { BaseTocPlugin } from '@platejs/toc';

import { TocElementStatic } from '@/client/components/ui/toc-node-static';

export const BaseTocKit = [BaseTocPlugin.withComponent(TocElementStatic)];
