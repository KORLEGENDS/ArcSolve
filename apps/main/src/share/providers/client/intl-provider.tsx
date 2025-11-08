'use client';

import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';

export interface IntlProviderProps {
  children: ReactNode;
  messages: Record<string, unknown>;
  locale: string;
  timeZone?: string;
  now?: Date | string;
}

export function IntlProvider({
  children,
  messages,
  locale,
  timeZone = 'Asia/Seoul',
  now,
}: IntlProviderProps): ReactNode {
  const nowDate = typeof now === 'string' ? new Date(now) : now;
  return (
    <NextIntlClientProvider messages={messages} locale={locale} timeZone={timeZone} now={nowDate}>
      {children}
    </NextIntlClientProvider>
  );
}


