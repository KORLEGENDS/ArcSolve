import { BaseSuggestionPlugin } from '@platejs/suggestion';

import { SuggestionLeafStatic } from '@/client/components/ui/suggestion-node-static';

export const BaseSuggestionKit = [
  BaseSuggestionPlugin.withComponent(SuggestionLeafStatic),
];
