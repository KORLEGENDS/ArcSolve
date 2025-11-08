import { env, isDevelopment } from '@/share/configs/environments/server-constants';
import Redis from 'ioredis';

// ==================== Redis 클라이언트 싱글턴 ====================

let redisSingleton: Redis | null = null;

function createRedisClient(): Redis {
  // 개발: 환경변수 미설정 시 평문 로컬 6379
  if (isDevelopment && !env.REDIS_HOST) {
    const client = new Redis('redis://127.0.0.1:6379', {
      enableAutoPipelining: true,
      maxRetriesPerRequest: 5,
      connectionName: 'arcsolve-main',
      keepAlive: 30000,
    });
    client.on('error', (error) => {
      // Redis 연결 에러는 로깅하지 않음 (의도적 무시)
      console.warn('Redis client error (ignored):', error.message);
    });
    return client;
  }

  const host = env.REDIS_HOST ?? '127.0.0.1';
  const port = Number(env.REDIS_PORT ?? 16380);
  const password = env.REDIS_PASSWORD ?? undefined;
  const tlsEnabled = env.REDIS_TLS_ENABLED;
  const servername = env.REDIS_TLS_SERVERNAME ?? 'redis.arcsolve.ai';

  const tls = tlsEnabled ? { servername } : undefined;
  
  const client = new Redis({
    host,
    port,
    password,
    enableAutoPipelining: true,
    maxRetriesPerRequest: 5,
    connectionName: 'arcsolve-main',
    keepAlive: 30000,
    tls,
  });
  client.on('error', (error) => {
    // Redis 연결 에러는 로깅하지 않음 (의도적 무시)
    console.warn('Redis subscriber error (ignored):', error.message);
  });
  return client;
}

export function getRedis(): Redis {
  // 항상 Redis를 사용한다고 가정하고 즉시 생성/반환
  redisSingleton ??= createRedisClient();
  return redisSingleton as Redis;
}

// ==================== 캐시 키 (중앙화된 상수 사용) ====================

export const CacheKey = {
  FILE_STATUS_CHANNEL: (id: string) => `file:status:${id}`,
  // Session-related keys
  session: {
    refreshToken: (userId: string) => `session:refresh:${userId}`,
  },
  // Security-related keys
  security: {
    csrf: (tokenId: string) => `security:csrf:${tokenId}`,
    pkce: (codeVerifierId: string) => `security:pkce:${codeVerifierId}`,
    lock: (id: string) => `security:lock:${id}`,
  },
  // Rate limit keys
  rateLimit: {
    user: (userId: string) => `ratelimit:user:${userId}`,
    ip: (ip: string) => `ratelimit:ip:${ip}`,
  },
  // Chat/history keys (for compatibility)
  chat: {
    messages: (chatId: string) => `chat:${chatId}:messages`,
  },
  // R2 cache keys
  r2: {
    downloadUrl: (
      storageKey: string,
      options?: { filename?: string; mimeType?: string; inline?: boolean }
    ) =>
      `r2:download:${storageKey}:${options?.filename ?? ''}:${options?.mimeType ?? ''}:${options?.inline ? '1' : '0'}`,
  },
} as const;
