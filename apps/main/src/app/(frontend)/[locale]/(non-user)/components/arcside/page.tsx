'use client';

import { Sidebar } from '@/client/components/arc/ArcSide';
import { SidebarProvider } from '@/client/components/arc/ArcSide/components';

export default function ArcSideDemoPage() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', width: '100%' }}>
      <SidebarProvider
        style={{ flex: '0 0 auto', width: 'auto' }}
        defaultOpen={true}
        cookieKeyPrefix="demo-left"
      >
        <Sidebar.Left />
      </SidebarProvider>

      <main
        style={{
          flex: '1 1 auto',
          minWidth: 0,
          backgroundColor: 'var(--color-background)',
        }}
      >
        <p className="text-muted-foreground">
          메인 콘텐츠 영역입니다.
        </p>
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

