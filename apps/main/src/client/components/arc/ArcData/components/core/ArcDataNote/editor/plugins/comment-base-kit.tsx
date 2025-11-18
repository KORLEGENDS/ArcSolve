import { BaseCommentPlugin } from '@platejs/comment';

import { CommentLeafStatic } from '../../ui/static/comment-node-static';

export const BaseCommentKit = [
  BaseCommentPlugin.withComponent(CommentLeafStatic),
];
