'use client';

import { useEffect, useState } from 'react';

export function useDebounce<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const handle = setTimeout(() => {
      requestAnimationFrame(() => setDebounced(value));
    }, Math.max(0, delayMs));
    return () => clearTimeout(handle);
  }, [value, delayMs]);

  return debounced;
}

export default useDebounce;


