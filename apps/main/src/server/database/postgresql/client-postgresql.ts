import { env } from '@/share/configs/environments/server-constants';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool, type PoolConfig } from 'pg';
// 중요: 순환 의존성 방지를 위해 barrel(index) 대신 schema/index에서 직접 import
import * as schema from '@/share/schema/drizzles';

/**
 * PostgreSQL 데이터베이스 클라이언트 설정
 * 싱글톤 패턴으로 연결 재사용
 */

// 전역 캐시 (HMR/장수 프로세스 안전 재사용)
declare global {
   
  var __arcsolvePgPool: Pool | undefined;
}

// 공통 Pool 설정 (환경 무관)
const commonPoolConfig = {
  keepAlive: true,
  keepAliveInitialDelayMillis: 30_000,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  statement_timeout: 10_000,
  idle_in_transaction_session_timeout: 30_000,
} as const;

function buildPgConfig(): PoolConfig {
  // env 값 그대로 사용 (기본값 없음 - env 검증 단계에서 필수값 검증)
  const ssl = env.POSTGRES_TLS_ENABLED
    ? {
        rejectUnauthorized: true,
        servername: env.POSTGRES_TLS_SERVERNAME,
      }
    : false;

  return {
    host: env.POSTGRES_HOST,
    port: env.POSTGRES_PORT,
    user: env.POSTGRES_USER,
    password: env.POSTGRES_PASSWORD,
    database: env.POSTGRES_DB,
    ssl,
    ...commonPoolConfig,
  };
}

export function getPgPool(): Pool {
  if (!globalThis.__arcsolvePgPool) {
    const pool = new Pool(buildPgConfig());
    // 최소 관찰성: 프로세스 크래시 방지를 위한 에러 핸들
    pool.on('error', () => {
      // 상위 로깅 레이어에서 수집하도록 여기서는 무시
    });
    globalThis.__arcsolvePgPool = pool;
  }
  return globalThis.__arcsolvePgPool;
}

// Drizzle ORM 인스턴스 생성
export const db: NodePgDatabase<typeof schema> = drizzle(getPgPool(), {
  schema,
  logger: false,
});

// 연결 상태 확인 함수
export async function checkConnection(): Promise<boolean> {
  try {
    await getPgPool().query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

// 연결 종료 함수 (필요시 사용)
export async function closeConnection(): Promise<void> {
  await getPgPool().end();
  globalThis.__arcsolvePgPool = undefined;
}