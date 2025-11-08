'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { type ComponentProps, type ReactNode } from 'react';

interface ThemeProviderProps {
  children: ReactNode;
}

// 정적 설정값 - 컴포넌트 외부에 선언 (타입 주도 구성)
type NextThemesProviderProps = ComponentProps<typeof NextThemesProvider>;
const THEME_CONFIG: Omit<NextThemesProviderProps, 'children'> = {
  attribute: 'class',
  defaultTheme: 'system',
  enableSystem: true,
  disableTransitionOnChange: false,
  storageKey: 'arcsolve-theme',
  themes: ['light', 'dark', 'system'],
};

export function ThemeProvider({ children }: ThemeProviderProps): ReactNode {
  return <NextThemesProvider {...THEME_CONFIG}>{children}</NextThemesProvider>;
}
