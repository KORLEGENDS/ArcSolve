import { SidebarWrapper } from '@/client/components/arc/ArcSide';
import type { IJsonModel } from 'flexlayout-react';
import { cookies } from 'next/headers';
import type { ReactNode } from 'react';
import { ArcWorkWithChatRoom } from './components/ArcWorkWithChatRoom';
import { RightSidebarContent } from './components/RightSidebarContent';
import { RightSidebarHeader } from './components/RightSidebarHeader';
import { SidebarContent } from './components/SidebarContent';
import { SidebarFooter } from './components/SidebarFooter';
import { SidebarHeader } from './components/SidebarHeader';

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

  // ArcWork 기본 레이아웃 설정
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
              name: 'Chat Room',
              component: 'arcyou-chat-room',
            },
          ],
        },
      ],
    },
  };

  return (
    <div style={{ display: 'flex', minHeight: '100svh', width: '100%' }}>
        <SidebarWrapper
          side="left"
          expanded={<SidebarContent />}
          header={<SidebarHeader />}
          footer={<SidebarFooter />}
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
            <ArcWorkWithChatRoom
              className="absolute inset-0 z-48"
              defaultLayout={defaultJson}
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
