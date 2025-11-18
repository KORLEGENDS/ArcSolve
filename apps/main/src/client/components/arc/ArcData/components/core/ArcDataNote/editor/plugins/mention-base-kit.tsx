import { BaseMentionPlugin } from '@platejs/mention';

import { MentionElementStatic } from '../../ui/static/mention-node-static';

export const BaseMentionKit = [
  BaseMentionPlugin.withComponent(MentionElementStatic),
];
