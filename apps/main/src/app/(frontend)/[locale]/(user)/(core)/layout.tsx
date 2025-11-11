import { SidebarWrapper } from '@/client/components/arc/ArcSide';
import { cookies } from 'next/headers';
import type { ReactNode } from 'react';
import { ArcWorkContent } from './components/ArcWorkContent';
import { LeftSidebarContent } from './components/LeftSidebarContent';
import { LeftSidebarFooter } from './components/LeftSidebarFooter';
import { LeftSidebarHeader } from './components/LeftSidebarHeader';
import { RightSidebarContent } from './components/RightSidebarContent';
import { RightSidebarHeader } from './components/RightSidebarHeader';

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
        <SidebarWrapper
          side="left"
          expanded={<LeftSidebarContent />}
          header={<LeftSidebarHeader />}
          footer={<LeftSidebarFooter />}
          defaultOpen={leftDefaultOpen}
          defaultWidth={leftWidth}
          cookieKeyPrefix="left"
        />

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
            <ArcWorkContent
              className="absolute inset-0 z-48"
            />
            {children}
          </div>
        </main>

        <SidebarWrapper
          side="right"
          expanded={<RightSidebarContent />}
          header={<RightSidebarHeader />}
          defaultOpen={rightDefaultOpen}
          defaultWidth={rightWidth}
          cookieKeyPrefix="right"
        />
      </div>
  );
}
