'use client';

import { LinkPlugin } from '@platejs/link/react';

import { LinkElement } from '@/client/components/ui/link-node';
import { LinkFloatingToolbar } from '@/client/components/ui/link-toolbar';

export const LinkKit = [
  LinkPlugin.configure({
    render: {
      node: LinkElement,
      afterEditable: () => <LinkFloatingToolbar />,
    },
  }),
];
