/**
 * 클라이언트 전용 환경변수 스키마
 * 브라우저에서 안전하게 사용 가능 (서버 로거 의존성 없음)
 */

import { clientEnvSchema } from './schemas-constants';

export function getClientEnv() {
  const tmp: Record<string, string | undefined> = {
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_APP_URL: process.env['NEXT_PUBLIC_APP_URL'],
    NEXT_PUBLIC_TOSS_CLIENT_KEY: process.env['NEXT_PUBLIC_TOSS_CLIENT_KEY'],
    NEXT_PUBLIC_ORDER_ID_TTL_MS: process.env['NEXT_PUBLIC_ORDER_ID_TTL_MS'],
    NEXT_PUBLIC_API_URL: process.env['NEXT_PUBLIC_API_URL'],
  };
  const result = clientEnvSchema.safeParse(tmp);
  if (!result.success) {
    throw new Error('Invalid client environment variables');
  }
  return result.data;
}

export const clientEnv = getClientEnv();
