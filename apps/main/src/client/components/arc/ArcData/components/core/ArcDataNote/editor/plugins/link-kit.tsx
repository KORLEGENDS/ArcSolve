'use client';

import { LinkPlugin } from '@platejs/link/react';

import { LinkElement } from '../../ui/node/link-node';
import { LinkFloatingToolbar } from '../../ui/toolbar/link-toolbar';

export const LinkKit = [
  LinkPlugin.configure({
    render: {
      node: LinkElement,
      afterEditable: () => <LinkFloatingToolbar />,
    },
  }),
];
