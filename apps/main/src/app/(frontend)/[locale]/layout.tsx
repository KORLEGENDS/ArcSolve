import { createPageMetadata } from '@/client/metadata';
import '@/client/styles/index.css';
import { AppProviders } from '@/share/providers/client/client-providers';
import { InitProviders } from '@/share/providers/server/server-providers';
import type { Metadata } from 'next';
import { getLocale, getMessages } from 'next-intl/server';
import type { ReactNode } from 'react';

export const metadata: Metadata = createPageMetadata({
  title: 'ArcSolve',
  description: '지식 관리의 미래, ArcSolve',
  keywords: ['ArcSolve', 'ArcSolve AI'],
});

interface RootLayoutProps {
  children: ReactNode;
}

/**
 * 루트 레이아웃 (서버 컴포넌트)
 * - metadata export를 위해 서버 컴포넌트로 유지
 */
export default async function RootLayout({ children }: RootLayoutProps): Promise<ReactNode> {
  const [locale, messages] = await Promise.all([getLocale(), getMessages()]);

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <link rel='preconnect' href='https://fonts.googleapis.com' />
        <link
          rel='preconnect'
          href='https://fonts.gstatic.com'
          crossOrigin='anonymous'
        />
        <link
          href='https://fonts.googleapis.com/css2?family=Gowun+Batang:wght@400;700&display=swap'
          rel='stylesheet'
        />
      </head>
      <body>
        <InitProviders>
          <AppProviders intl={{ locale, messages, timeZone: 'Asia/Seoul', now: new Date().toISOString() }}>
            {children}
          </AppProviders>
        </InitProviders>
      </body>
    </html>
  );
}
