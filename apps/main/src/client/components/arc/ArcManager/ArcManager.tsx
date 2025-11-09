'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/client/components/ui/custom/tabs';
import { type LucideIcon } from 'lucide-react';
import * as React from 'react';
import s from './ArcManager.module.css';

export interface ArcManagerTabConfig {
  value: string;
  icon?: LucideIcon;
  label: string;
}

interface ArcManagerBaseProps {
  children?: React.ReactNode;
  className?: string;
  // Tabs 통합 props
  tabs?: ArcManagerTabConfig[];
  defaultTab?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  // Toolbar
  toolbar?: React.ReactNode;
}

function ArcManagerBase({
  children,
  className,
  tabs,
  defaultTab,
  value,
  onValueChange,
  toolbar,
}: ArcManagerBaseProps): React.ReactElement {
  return (
    <div className={`${s.container} ${className || ''}`}>
      {tabs && tabs.length > 0 ? (
        <Tabs
          defaultValue={defaultTab || tabs[0]?.value}
          value={value}
          onValueChange={onValueChange}
          className="h-full flex flex-col"
        >
          <div className={s.tabs}>
            <TabsList>
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <TabsTrigger key={tab.value} value={tab.value}>
                    {Icon && <Icon className="w-4 h-4" />}
                    <span>{tab.label}</span>
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </div>
          {toolbar && <div className={s.toolbar}>{toolbar}</div>}
          {children}
        </Tabs>
      ) : (
        children
      )}
    </div>
  );
}

function ArcManagerTabPanel({
  children,
  value,
  className,
}: {
  children?: React.ReactNode;
  value: string;
  className?: string;
}): React.ReactElement {
  return (
    <TabsContent value={value} className={`flex-1 min-h-0 ${className || ''}`}>
      <div className={s.content}>{children}</div>
    </TabsContent>
  );
}

// 네임스페이스 패턴 적용
Object.assign(ArcManagerBase, {
  TabPanel: ArcManagerTabPanel,
});

// 타입 확장된 ArcManager를 export
export const ArcManager = ArcManagerBase as typeof ArcManagerBase & {
  TabPanel: typeof ArcManagerTabPanel;
};

