import { type ComponentType, type ReactNode } from 'react';

export type ProviderConfig<T = Record<string, unknown>> = [
  ComponentType<{ children: ReactNode } & T>,
  T,
];

export interface ComposedProviderProps {
  children: ReactNode;
}

export function composeProviders<T extends readonly ProviderConfig[]>(
  providers: T
): ComponentType<ComposedProviderProps> {
  return function ComposedProvider({
    children,
  }: ComposedProviderProps): ReactNode {
    return providers.reduceRight(
      (acc: ReactNode, [Provider, props]) => (
        <Provider {...(props as object)}>{acc}</Provider>
      ),
      children
    );
  };
}

