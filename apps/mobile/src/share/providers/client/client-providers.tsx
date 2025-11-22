/**
 * 통합 AppProviders - 의존성 기반 Provider 순서
 */

import { type ReactNode, useMemo, type ComponentType } from 'react';
import {
  type ComposedProviderProps,
  composeProviders,
  type ProviderConfig,
} from '../providers-utils/app-provider-utils';
import { QueryProvider } from './query-provider';
import { AuthProvider } from './auth-provider';

export interface AppProvidersProps {
  children: ReactNode;
}

export function AppProviders({ children }: AppProvidersProps): ReactNode {
  // Provider 설정을 useMemo로 최적화
  const ComposedProviders = useMemo((): ComponentType<ComposedProviderProps> => {
    // 정적 Provider 설정 (순서 중요: QueryProvider -> AuthProvider)
    const staticProviders: ProviderConfig<any>[] = [
      [QueryProvider, {}],
      [AuthProvider, {}],
    ];

    return composeProviders(staticProviders);
  }, []);

  return <ComposedProviders>{children}</ComposedProviders>;
}

