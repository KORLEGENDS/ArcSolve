'use client';

import * as TabsPrimitive from '@radix-ui/react-tabs';
import * as React from 'react';

import { cn } from '@/client/components/ui/utils';
import styles from './tabs.module.css';

function Tabs({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot='tabs'
      className={cn('flex flex-col gap-2', styles.tabsRoot, className)}
      {...props}
    />
  );
}

function TabsList({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [tabCount, setTabCount] = React.useState(0);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [isTransitioning, setIsTransitioning] = React.useState(false);

  const recompute = React.useCallback((withTransition = false): void => {
    const container = containerRef.current;
    if (!container) return;

    const triggers = Array.from(container.querySelectorAll<HTMLElement>("[role='tab']"));
    const count = triggers.length;
    const activeIdx = Math.max(
      0,
      triggers.findIndex(t => t.getAttribute('aria-selected') === 'true')
    );

    if (withTransition) setIsTransitioning(true);
    setTabCount(count);
    setActiveIndex(activeIdx < 0 ? 0 : activeIdx);
    if (withTransition) setTimeout(() => setIsTransitioning(false), 300);
  }, []);

  React.useEffect(() => {
    recompute(false);

    const container = containerRef.current;
    if (!container) return;

    const mo = new MutationObserver(mutations => {
      const hasSelectionChange = mutations.some(m =>
        m.type === 'attributes' && m.attributeName === 'aria-selected'
      );
      // 선택 변경: 애니메이션 on, 구조 변경: off
      recompute(hasSelectionChange);
    });
    mo.observe(container, {
      attributes: true,
      subtree: true,
      childList: true,
      attributeFilter: ['aria-selected'],
    });

    return () => {
      mo.disconnect();
    };
  }, [recompute]);

  return (
    <TabsPrimitive.List
      ref={containerRef as React.RefObject<HTMLDivElement>}
      data-slot='tabs-list'
      className={cn(styles.tabsContainer, className)}
      style={
        {
          '--tab-count': tabCount || 1,
          '--active-index': activeIndex || 0,
        } as React.CSSProperties
      }
      {...props}
    >
      {props.children}
      <div
        className={cn(
          styles.tabIndicator,
          isTransitioning && styles.tabIndicatorTransition
        )}
        aria-hidden
      />
    </TabsPrimitive.List>
  );
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot='tabs-trigger'
      className={cn(styles.tabButton, className)}
      {...props}
    />
  );
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot='tabs-content'
      className={cn('flex-1 outline-none', className)}
      {...props}
    />
  );
}

export { Tabs, TabsContent, TabsList, TabsTrigger };
