'use client';

import { ArcWork } from '@/client/components/arc/ArcWork';
import { Card, CardContent, CardHeader, CardTitle } from '@/client/components/ui/card';
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

export default function ArcWorkDemoPage() {
  const handleModelChange = React.useCallback((model: Model, action: Action) => {
    console.log('Model changed:', action.type, model.toJson());
  }, []);

  return (
    <main className="min-h-screen w-full p-6 space-y-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">ArcWork 컴포넌트 데모</h1>
          <p className="text-muted-foreground">
            FlexLayout을 사용한 리사이즈 가능한 탭 레이아웃 컴포넌트입니다.
          </p>
        </div>

        <section className="mb-12">
          <Card>
            <CardHeader>
              <CardTitle>ArcWork 컴포넌트</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[600px] border rounded-lg overflow-hidden">
                <ArcWork
                  className="h-full w-full"
                  defaultLayout={defaultJson}
                  onModelChange={handleModelChange}
                />
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}

