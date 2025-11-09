'use client';

import { PanelLeft, PanelLeftClose } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/client/components/ui/button';
import { cn } from '@/client/components/ui/utils';
import {
  MAX_SIDEBAR_WIDTH,
  MIN_SIDEBAR_WIDTH,
  SIDEBAR_WIDTH,
  SIDEBAR_WIDTH_ICON
} from '../ArcSide-config';
import { useSidebarResize } from '../hooks/useSidebarResize';
import { useSidebarState } from '../hooks/useSidebarState';
import { mergeButtonRefs } from '../utils/mergeButtonRef';
import styles from './core.module.css';

interface SidebarContext {
  state: 'expanded' | 'collapsed';
  open: boolean;
  setOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  width: string;
  setWidth: (width: string) => void;
  isDraggingRail: boolean;
  setIsDraggingRail: (isDraggingRail: boolean) => void;
  stateCookieName: string;
  widthCookieName: string;
  widthCookieMaxAge: number;
  isCompact: boolean;
}

const SidebarContext = React.createContext<SidebarContext | null>(null);

function useSidebar(): SidebarContext {
  const context = React.useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider.');
  }

  return context;
}

// toPx moved to utils/dimension

const SidebarProvider = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<'div'> & {
    defaultOpen?: boolean;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    //* new prop for default width
    defaultWidth?: string;
    //* cookie config to support parallel sidebars
    cookieKeyPrefix?: string; // e.g., "left" | "right"
    stateCookieName?: string;
    widthCookieName?: string;
    widthCookieMaxAge?: number;
  }
>(
  (
    {
      defaultOpen = true,
      open: openProp,
      onOpenChange: setOpenProp,
      className,
      style,
      children,
      defaultWidth = SIDEBAR_WIDTH,
      cookieKeyPrefix,
      stateCookieName: stateCookieNameProp,
      widthCookieName: widthCookieNameProp,
      widthCookieMaxAge: widthCookieMaxAgeProp,
      ...props
    },
    ref
  ) => {
    //* 상태 관리 로직을 useSidebarState 훅으로 분리
    const sidebarState = useSidebarState({
      defaultOpen,
      open: openProp,
      onOpenChange: setOpenProp,
      defaultWidth,
      cookieKeyPrefix,
      stateCookieName: stateCookieNameProp,
      widthCookieName: widthCookieNameProp,
      widthCookieMaxAge: widthCookieMaxAgeProp,
    });

    const {
      state,
      open,
      width,
      isDraggingRail,
      isCompact,
      setOpen,
      setWidth,
      setIsDraggingRail,
      toggleSidebar,
      stateCookieName: derivedStateCookieName,
      widthCookieName: derivedWidthCookieName,
      widthCookieMaxAge: derivedWidthCookieMaxAge,
    } = sidebarState;

    const contextValue = React.useMemo<SidebarContext>(
      () => ({
        state,
        open,
        setOpen,
        toggleSidebar,
        width,
        setWidth,
        isDraggingRail,
        setIsDraggingRail,
        stateCookieName: derivedStateCookieName,
        widthCookieName: derivedWidthCookieName,
        widthCookieMaxAge: derivedWidthCookieMaxAge,
        isCompact,
      }),
      [
        state,
        open,
        setOpen,
        toggleSidebar,
        width,
        isDraggingRail,
        setIsDraggingRail,
        derivedStateCookieName,
        derivedWidthCookieName,
        derivedWidthCookieMaxAge,
        isCompact,
      ]
    );

    return (
      <SidebarContext.Provider value={contextValue}>
        <div
          style={
            {
              '--sidebar-width': width,
              '--sidebar-width-icon': SIDEBAR_WIDTH_ICON,
              ...style,
            } as React.CSSProperties
          }
          className={cn('group/sidebar-wrapper', styles.provider, className)}
          ref={ref}
          {...props}
        >
          {children}
        </div>
      </SidebarContext.Provider>
    );
  }
);
SidebarProvider.displayName = 'SidebarProvider';

const Sidebar = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<'div'> & {
    side?: 'left' | 'right';
  }
>(
  (
    {
      side = 'left',
      className,
      children,
      ...props
    },
    ref
  ) => {
    const {
      state,
      isDraggingRail,
      isCompact,
    } = useSidebar();

    return (
      <div
        ref={ref}
        className={cn('group peer', styles.sidebarRoot)}
        data-state={state}
        data-side={side}
        data-dragging={isDraggingRail}
        data-compact={isCompact ? 'true' : undefined}
      >
        {/* This is what handles the sidebar gap on desktop */}
        <div className={styles.sidebarGap} />
        <div className={cn(styles.sidebarContainer, className)} {...props}>
          <div data-sidebar='sidebar' className={styles.sidebarSurface}>
            {children}
          </div>
        </div>
      </div>
    );
  }
);
Sidebar.displayName = 'Sidebar';

const SidebarTrigger = React.forwardRef<
  React.ComponentRef<typeof Button>,
  React.ComponentProps<typeof Button>
>(({ className, onClick, ...props }, ref) => {
  const { toggleSidebar, open } = useSidebar();

  return (
    <Button
      ref={ref}
      data-sidebar='trigger'
      variant='ghost'
      size='sm'
      className={cn('h-7 w-7 bg-foreground text-background', className)}
      aria-pressed={open}
      onClick={(event) => {
        onClick?.(event);
        toggleSidebar();
      }}
      {...props}
    >
      <span className={cn(styles.triggerIcon, open && styles.triggerIconOpen)}>
        {open ? <PanelLeftClose /> : <PanelLeft />}
      </span>
      <span className='sr-only'>Toggle Sidebar</span>
    </Button>
  );
});
SidebarTrigger.displayName = 'SidebarTrigger';

const SidebarHeader = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<'div'>
>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      data-sidebar='header'
      className={cn(styles.headerBlock, className)}
      {...props}
    />
  );
});
SidebarHeader.displayName = 'SidebarHeader';

const SidebarFooter = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<'div'>
>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      data-sidebar='footer'
      className={cn(styles.footerBlock, className)}
      {...props}
    />
  );
});
SidebarFooter.displayName = 'SidebarFooter';

// SidebarSeparator removed

const SidebarContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<'div'>
>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      data-sidebar='content'
      className={cn(styles.content, className)}
      {...props}
    />
  );
});
SidebarContent.displayName = 'SidebarContent';

const SidebarRail = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<'button'> & {
    enableDrag?: boolean;
    direction?: 'left' | 'right';
  }
>(({ className, enableDrag = true, direction = 'right', ...props }, ref) => {
  const {
    toggleSidebar,
    setWidth,
    state,
    width,
    setIsDraggingRail,
    widthCookieName,
    widthCookieMaxAge,
  } = useSidebar();

  const { dragRef, handlePointerDown } = useSidebarResize({
    direction,
    enableDrag,
    onResize: setWidth,
    onToggle: toggleSidebar,
    currentWidth: width,
    isCollapsed: state === 'collapsed',
    minResizeWidth: MIN_SIDEBAR_WIDTH,
    maxResizeWidth: MAX_SIDEBAR_WIDTH,
    setIsDraggingRail,
    widthCookieName,
    widthCookieMaxAge,
  });

  const combinedRef = React.useMemo(
    () => mergeButtonRefs([ref, dragRef]),
    [ref, dragRef]
  );

  return (
    <button
      ref={combinedRef}
      data-sidebar='rail'
      aria-label='Toggle Sidebar'
      tabIndex={-1}
      onPointerDown={handlePointerDown}
      title='Toggle Sidebar'
      className={cn(styles.rail, className)}
      {...props}
    />
  );
});
SidebarRail.displayName = 'SidebarRail';

// 네임스페이스 패턴 적용: Sidebar.Header, Sidebar.Content 등으로 사용 가능
// 런타임에 속성 추가
Object.assign(Sidebar, {
  Header: SidebarHeader,
  Content: SidebarContent,
  Footer: SidebarFooter,
  Rail: SidebarRail,
  Trigger: SidebarTrigger,
});

// SidebarProvider에도 네임스페이스 패턴 적용
Object.assign(SidebarProvider, {
  Sidebar: Sidebar,
});

// 타입 확장을 위한 타입 단언으로 export
const SidebarWithNamespace = Sidebar as typeof Sidebar & {
  Header: typeof SidebarHeader;
  Content: typeof SidebarContent;
  Footer: typeof SidebarFooter;
  Rail: typeof SidebarRail;
  Trigger: typeof SidebarTrigger;
};

const SidebarProviderWithNamespace = SidebarProvider as typeof SidebarProvider & {
  Sidebar: typeof Sidebar;
};

export {
  SidebarWithNamespace as Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarProviderWithNamespace as SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar
};

