'use client';

import { useSystemSetNetworkStatus } from '@/client/states/stores/system-store';
import { type ReactNode, useEffect } from 'react';

interface NetworkProviderProps {
  children: ReactNode;
}

interface NetworkInformation extends EventTarget {
  readonly effectiveType: 'slow-2g' | '2g' | '3g' | '4g';
  readonly downlink: number;
  readonly rtt: number;
  addEventListener(type: 'change', listener: EventListener): void;
  removeEventListener(type: 'change', listener: EventListener): void;
}

declare global {
  interface Navigator {
    connection?: NetworkInformation;
  }
}

export function NetworkProvider({ children }: NetworkProviderProps): ReactNode {
  const setNetworkStatus = useSystemSetNetworkStatus();

  useEffect((): (() => void) => {
    setNetworkStatus({ status: navigator.onLine ? 'online' : 'offline' });

    const handleOnline = (): void => {
      setNetworkStatus({ status: 'online', message: '' });
    };

    const handleOffline = (): void => {
      setNetworkStatus({
        status: 'offline',
        message: '인터넷 연결이 끊어졌습니다. 네트워크 연결을 확인해주세요.',
      });
    };

    const checkNetworkSpeed = (): void => {
      if ('connection' in navigator && navigator.connection) {
        const connection = navigator.connection as NetworkInformation;
        const effectiveType = connection.effectiveType;
        if (effectiveType === '2g' || effectiveType === 'slow-2g') {
          setNetworkStatus({
            status: 'slow',
            message: '네트워크 연결이 느립니다.',
          });
        }
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    if ('connection' in navigator && navigator.connection) {
      const connection = navigator.connection as NetworkInformation;
      connection.addEventListener('change', checkNetworkSpeed);
      checkNetworkSpeed();
    }

    return (): void => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if ('connection' in navigator && navigator.connection) {
        const connection = navigator.connection as NetworkInformation;
        connection.removeEventListener('change', checkNetworkSpeed);
      }
    };
  }, [setNetworkStatus]);

  return children;
}
