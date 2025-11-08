import { env } from '@/share/configs/environments/server-constants';
import Redis from 'ioredis';

// ==================== Redis 클라이언트 싱글턴 ====================

// 전역 캐시 (HMR/장수 프로세스 안전 재사용)
declare global {
  var __arcsolveRedisClient: Redis | undefined;
}

// 공통 Redis 설정 (환경 무관)
const commonRedisConfig = {
  enableAutoPipelining: true,
  maxRetriesPerRequest: 5,
  connectionName: 'arcsolve-main',
  keepAlive: 30000,
} as const;

function createRedisClient(): Redis {
  // env 값 그대로 사용 (기본값 없음 - env 검증 단계에서 필수값 검증)
  const tls = env.REDIS_TLS_ENABLED
    ? { servername: env.REDIS_TLS_SERVERNAME }
    : undefined;

  const client = new Redis({
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD,
    tls,
    ...commonRedisConfig,
  });

  client.on('error', (error) => {
    // Redis 연결 에러는 로깅하지 않음 (의도적 무시)
    console.warn('Redis client error (ignored):', error.message);
  });

  return client;
}

export function getRedis(): Redis {
  if (!globalThis.__arcsolveRedisClient) {
    globalThis.__arcsolveRedisClient = createRedisClient();
  }
  return globalThis.__arcsolveRedisClient;
}
