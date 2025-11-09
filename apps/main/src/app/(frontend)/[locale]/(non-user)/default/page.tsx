'use client';

import { Sidebar } from '@/client/components/arc/ArcSide';
import { SidebarProvider } from '@/client/components/arc/ArcSide/components';
import { ArcWork } from '@/client/components/arc/ArcWork';
import type { Action, IJsonModel } from 'flexlayout-react';
import { Model } from 'flexlayout-react';
import * as React from 'react';

const defaultJson: IJsonModel = {
  global: {},
  borders: [],
  layout: {
    type: 'row',
    weight: 100,
    children: [
      {
        type: 'tabset',
        weight: 50,
        children: [
          {
            type: 'tab',
            name: 'Work 1',
            component: 'placeholder',
          },
        ],
      },
      {
        type: 'tabset',
        weight: 50,
        children: [
          {
            type: 'tab',
            name: 'Work 2',
            component: 'placeholder',
          },
        ],
      },
    ],
  },
};

export default function DefaultLayoutDemoPage() {
  const handleModelChange = React.useCallback((model: Model, action: Action) => {
    console.log('Model changed:', action.type, model.toJson());
  }, []);

  return (
    <div style={{ display: 'flex', minHeight: '100svh', width: '100%' }}>
      <SidebarProvider
        style={{ flex: '0 0 auto', width: 'auto' }}
        defaultOpen={true}
        cookieKeyPrefix="demo-left"
      >
        <Sidebar.Left />
      </SidebarProvider>

      <main
        style={{
          position: 'relative',
          display: 'flex',
          minHeight: '100svh',
          flex: '1 1 auto',
          minWidth: 0,
          flexDirection: 'column',
          backgroundColor: 'var(--color-background)',
          overflowX: 'hidden',
        }}
      >
        <div className="relative h-full w-full">
          <ArcWork
            className="absolute inset-0"
            defaultLayout={defaultJson}
            onModelChange={handleModelChange}
          />
        </div>
      </main>

      <SidebarProvider
        style={{ flex: '0 0 auto', width: 'auto' }}
        defaultOpen={true}
        cookieKeyPrefix="demo-right"
      >
        <Sidebar.Right />
      </SidebarProvider>
    </div>
  );
}

