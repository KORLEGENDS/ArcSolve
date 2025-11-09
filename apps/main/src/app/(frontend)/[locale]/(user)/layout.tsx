// import { ArcWork as ArcWorkNew } from '@/client/components/ui-core/Main';
import { Sidebar } from '@/client/components/arc/ArcSide';
import { SidebarProvider } from '@/client/components/arc/ArcSide/components';
// Event 관련 오버레이 제거
import { cookies } from 'next/headers';
import type { ReactNode } from 'react';

interface UserLayoutProps {
  children: ReactNode;
}

export default async function Layout({ children }: UserLayoutProps): Promise<ReactNode> {
  const cookieStore = await cookies();

  const leftState = cookieStore.get('sidebar:left:state')?.value;
  const leftWidth = cookieStore.get('sidebar:left:width')?.value;
  const rightState = cookieStore.get('sidebar:right:state')?.value;
  const rightWidth = cookieStore.get('sidebar:right:width')?.value;

  const leftDefaultOpen = leftState ? leftState === 'true' : true;
  const rightDefaultOpen = rightState ? rightState === 'true' : true;

  return (
    <div style={{ display: 'flex', minHeight: '100svh', width: '100%' }}>
        <SidebarProvider
          style={{ flex: '0 0 auto', width: 'auto' }}
          defaultOpen={leftDefaultOpen}
          defaultWidth={leftWidth}
          cookieKeyPrefix='left'
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
          <div className='relative h-full w-full'>
            <div className='absolute inset-0 z-48'>
              {/* <ArcWorkNew /> */}
            </div>
            {/* Event overlay removed */}
            {children}
          </div>
        </main>

        <SidebarProvider
          style={{ flex: '0 0 auto', width: 'auto' }}
          defaultOpen={rightDefaultOpen}
          defaultWidth={rightWidth}
          cookieKeyPrefix='right'
        >
          <Sidebar.Right />
        </SidebarProvider>
      </div>
  );
}
