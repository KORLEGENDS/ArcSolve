import { createAuthClient } from 'better-auth/react';
import { expoClient } from '@better-auth/expo/client';
import * as SecureStore from 'expo-secure-store';

import { API_BASE_URL } from '@/share/configs/environments/client-constants';

/**
 * Better Auth 클라이언트 (Expo 통합)
 *
 * - baseURL: 메인 서버 Better Auth 엔드포인트
 * - expoClient: 딥링크 + WebBrowser + SecureStore 쿠키 브릿지 처리
 */
export const authClient = createAuthClient({
  baseURL: `${API_BASE_URL}/api/auth/better`,
  plugins: [
    expoClient({
      scheme: 'arcsolve',
      storagePrefix: 'arcsolve',
      storage: SecureStore,
    }),
  ],
});


