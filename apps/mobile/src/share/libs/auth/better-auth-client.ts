import { expoClient } from '@better-auth/expo/client';
import { createAuthClient } from 'better-auth/react';
import * as SecureStore from 'expo-secure-store';

import { API_BASE_URL } from '@/share/configs/environments/client-constants';

export const authClient = createAuthClient({
  /**
   * Better Auth 서버 엔드포인트
   *
   * - 서버 라우트: /api/auth/[...auth]
   * - 모바일에서는 EXPO_PUBLIC_API_BASE_URL (예: http://localhost:3000) 기준으로 호출
   */
  baseURL: `${API_BASE_URL}/api/auth`,
  plugins: [
    expoClient({
      scheme: 'arcsolve',
      storagePrefix: 'arcsolve',
      storage: SecureStore,
    }),
  ],
});


