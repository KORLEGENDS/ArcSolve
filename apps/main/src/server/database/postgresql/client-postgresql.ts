import { env, isDevelopment } from '@/share/configs/environments/server-constants';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
// 중요: 순환 의존성 방지를 위해 barrel(index) 대신 schema/index에서 직접 import
import * as schema from '@/share/schema/drizzles';

/**
 * PostgreSQL 데이터베이스 클라이언트 설정
 * 싱글톤 패턴으로 연결 재사용
 */

// 환경변수 의존 제거: 터널 고정 경로로 하드코딩 (요구사항에 따라 변경)

// 전역 타입 정의 (개발환경 연결 재사용)
declare global {
  var pgPoolConnection: Pool | undefined;
}

// 하드코딩된 접속 설정 (cloudflared access tcp: pg.arcsolve.ai -> 127.0.0.1:15432)
const PROD_PG_CONFIG = {
  host: env.POSTGRES_HOST ?? '127.0.0.1',
  port: Number(env.POSTGRES_PORT ?? 15432),
  user: env.POSTGRES_USER ?? 'postgres',
  password: env.POSTGRES_PASSWORD ?? 'postgres',
  database: env.POSTGRES_DB ?? 'arcsolve',
  ssl: env.POSTGRES_TLS_ENABLED ?? true
    ? {
        rejectUnauthorized: true,
        servername: env.POSTGRES_TLS_SERVERNAME ?? 'pg.arcsolve.ai',
      }
    : false,
} as const;

const DEV_PG_CONFIG = {
  host: env.POSTGRES_HOST ?? 'localhost',
  port: Number(env.POSTGRES_PORT ?? 5432),
  user: env.POSTGRES_USER ?? 'postgres',
  password: env.POSTGRES_PASSWORD ?? 'postgres',
  database: env.POSTGRES_DB ?? 'arcsolve',
  ssl: false as const,
};

// 싱글톤 연결 관리
let pool: Pool;

const commonPoolOptions = {
  max: process.env.NODE_ENV === 'production' ? 10 : 5,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
} as const;

// 환경변수 대신 하드코딩된 설정을 사용하여 항상 동일 경로로 접속
if (process.env.NODE_ENV === 'production') {
  pool = new Pool({ ...(isDevelopment ? DEV_PG_CONFIG : PROD_PG_CONFIG), ...commonPoolOptions });
} else {
  global.pgPoolConnection ??= new Pool({ ...(isDevelopment ? DEV_PG_CONFIG : PROD_PG_CONFIG), ...commonPoolOptions });
  pool = global.pgPoolConnection;
}

// Drizzle ORM 인스턴스 생성
// 개발환경 로깅을 커스터마이즈하여 너무 긴 출력 방지
function createTruncatingLogger(_maxLength = 300) {
  const _ellipsis = '...';

  return {
    // Drizzle Logger 인터페이스 호환: logQuery(query, params)
    logQuery(_query: string, _params: unknown[]) {
      try {
        // SQL 로깅은 비활성화 (프로덕션에서는 logger: false로 설정됨)
      } catch {
        // 로깅 중 오류가 있어도 앱 동작에는 영향 없도록 noop
      }
    },
  };
}

export const db: NodePgDatabase<typeof schema> = drizzle(pool, {
  schema,
  logger: process.env.NODE_ENV === 'development' ? createTruncatingLogger(500) : false,
});

// 연결 상태 확인 함수
export async function checkConnection(): Promise<boolean> {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

// 연결 종료 함수 (필요시 사용)
export async function closeConnection(): Promise<void> {
  await pool.end();
}

// 편의 re-export는 상위 index에서 처리
