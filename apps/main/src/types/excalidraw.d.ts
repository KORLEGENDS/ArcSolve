declare module '@excalidraw/excalidraw' {
  import * as React from 'react';

  export const Excalidraw: React.ComponentType<any>;

  export const THEME: {
    LIGHT: string;
    DARK: string;
    [key: string]: string;
  };

  // 기타 유틸리티 타입/함수는 필요 시 확장합니다.
}


