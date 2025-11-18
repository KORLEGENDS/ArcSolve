import { BaseCommentPlugin } from '@platejs/comment';

import { CommentLeafStatic } from '@/client/components/ui/comment-node-static';

export const BaseCommentKit = [
  BaseCommentPlugin.withComponent(CommentLeafStatic),
];
