'use client';

import { createPlatePlugin } from 'platejs/react';

import { FixedToolbar } from '../../ui/toolbar/fixed-toolbar';
import { FixedToolbarButtons } from '../../ui/buttons/fixed-toolbar-buttons';

export const FixedToolbarKit = [
  createPlatePlugin({
    key: 'fixed-toolbar',
    render: {
      beforeEditable: () => (
        <FixedToolbar>
          <FixedToolbarButtons />
        </FixedToolbar>
      ),
    },
  }),
];
