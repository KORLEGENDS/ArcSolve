/**
 * 환경변수 Zod 스키마 정의 (통합)
 * - ENV_KEYS를 사용한 일관된 키 정의
 * - VALIDATION_PATTERNS과 DEFAULT_VALUES 통합 관리
 * - 불필요한 타입 별칭 제거
 * - 검증 헬퍼 함수 포함
 */

import { z } from 'zod';
import { ENV_KEYS } from './keys-constants';

// ==================== 기본 타입 정의 ====================

export type NodeEnv = 'development' | 'production' | 'test';


// ==================== 환경변수 기본값 상수 ====================

export const DEFAULT_VALUES = {
  // 기본 설정
  NODE_ENV: 'development' as NodeEnv,

  // 인증 설정
  AUTH_DEBUG: false,

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: 60000,
  RATE_LIMIT_MAX_REQUESTS: 100,

  // ARC Service
  ARC_SERVICE_TIMEOUT: 5000, // 5초 기본 타임아웃
} as const;

// ==================== 기본 스키마 ====================

export const nodeEnvSchema = z
  .enum(['development', 'production', 'test'])
  .default(DEFAULT_VALUES.NODE_ENV);

// ==================== ENV Boolean 파서 (문자열 'false'를 false로 처리) ====================

const envBooleanSchema = z.preprocess((value) => {
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    if (v === 'true' || v === '1' || v === 'yes' || v === 'on') return true;
    if (v === 'false' || v === '0' || v === 'no' || v === 'off' || v === '') return false;
  }
  return value;
}, z.boolean());

// ==================== 클라이언트 환경변수 스키마 ====================

export const clientEnvSchema = z
  .object({
    [ENV_KEYS.COMMON.NODE_ENV]: nodeEnvSchema,
    [ENV_KEYS.CLIENT.APP.URL]: z.string().url().optional(),
    [ENV_KEYS.CLIENT.CHAT.WS_URL]: z.string().url().optional(),
    [ENV_KEYS.CLIENT.AUTH.OAUTH.KAKAO.CLIENT_ID]: z
      .string()
      .min(1, 'NEXT_PUBLIC_KAKAO_CLIENT_ID is required')
      .optional(),
    [ENV_KEYS.CLIENT.AUTH.OAUTH.NAVER.CLIENT_ID]: z
      .string()
      .min(1, 'NEXT_PUBLIC_NAVER_CLIENT_ID is required')
      .optional(),
    // 신규 공개 TTL 키는 문자열 리터럴로 직접 명시하여 린트 안전성 확보
    NEXT_PUBLIC_ORDER_ID_TTL_MS: z.coerce.number().min(60000).optional(),
  })
  .passthrough();

// ==================== 서버 환경변수 스키마 ====================

export const serverEnvSchema = z
  .object({
    // ===== 기본 설정 =====
    [ENV_KEYS.COMMON.NODE_ENV]: nodeEnvSchema,

    // ===== 데이터베이스 =====
    // PG URL 제거: 세분화된 키만 사용 (필수값)
    [ENV_KEYS.SERVER.DATABASE.POSTGRESQL.HOST]: z.string().min(1, 'POSTGRES_HOST is required'),
    [ENV_KEYS.SERVER.DATABASE.POSTGRESQL.PORT]: z.coerce.number().int().positive('POSTGRES_PORT must be a positive integer'),
    [ENV_KEYS.SERVER.DATABASE.POSTGRESQL.USER]: z.string().min(1, 'POSTGRES_USER is required'),
    [ENV_KEYS.SERVER.DATABASE.POSTGRESQL.PASSWORD]: z.string().min(1, 'POSTGRES_PASSWORD is required'),
    [ENV_KEYS.SERVER.DATABASE.POSTGRESQL.DATABASE]: z.string().min(1, 'POSTGRES_DB is required'),
    [ENV_KEYS.SERVER.DATABASE.POSTGRESQL.TLS.ENABLED]: envBooleanSchema.optional(),
    [ENV_KEYS.SERVER.DATABASE.POSTGRESQL.TLS.SERVERNAME]: z.string().optional(),
    // REDIS URL 제거: 세분화된 키만 사용 (필수값)
    [ENV_KEYS.SERVER.DATABASE.REDIS.HOST]: z.string().min(1, 'REDIS_HOST is required'),
    [ENV_KEYS.SERVER.DATABASE.REDIS.PORT]: z.coerce.number().int().positive('REDIS_PORT must be a positive integer'),
    [ENV_KEYS.SERVER.DATABASE.REDIS.PASSWORD]: z.string().min(1, 'REDIS_PASSWORD is required'),
    [ENV_KEYS.SERVER.DATABASE.REDIS.TLS.ENABLED]: envBooleanSchema.optional(),
    [ENV_KEYS.SERVER.DATABASE.REDIS.TLS.SERVERNAME]: z.string().optional(),

    // ===== 인증 (개발환경/프로덕션 공통 필수) =====
    [ENV_KEYS.SERVER.AUTH.CORE.SECRET]: z
      .string()
      .min(32, 'AUTH_SECRET must be at least 32 characters'),
    [ENV_KEYS.SERVER.AUTH.CORE.DEBUG]: envBooleanSchema.default(DEFAULT_VALUES.AUTH_DEBUG),

    // ===== OAuth 제공자 (NextAuth.js 스타일) =====
    [ENV_KEYS.SERVER.AUTH.OAUTH.KAKAO.ID]: z.string().optional(),
    [ENV_KEYS.SERVER.AUTH.OAUTH.KAKAO.SECRET]: z.string().optional(),
    [ENV_KEYS.SERVER.AUTH.OAUTH.NAVER.ID]: z.string().optional(),
    [ENV_KEYS.SERVER.AUTH.OAUTH.NAVER.SECRET]: z.string().optional(),
    [ENV_KEYS.SERVER.AUTH.OAUTH.COOKIE.DOMAIN]: z.string().optional(),

    // ===== Rate Limiting =====
    [ENV_KEYS.SERVER.MONITORING.RATE_LIMIT.WINDOW_MS]: z.coerce
      .number()
      .default(DEFAULT_VALUES.RATE_LIMIT_WINDOW_MS),
    [ENV_KEYS.SERVER.MONITORING.RATE_LIMIT.MAX_REQUESTS]: z.coerce
      .number()
      .default(DEFAULT_VALUES.RATE_LIMIT_MAX_REQUESTS),

    // ===== ARC Service (프록시 설정) =====
    [ENV_KEYS.SERVER.SERVICES.ARC.URL]: z.string().url().optional(), // 비즈니스 서버 URL (예: http://localhost:8000)
    [ENV_KEYS.SERVER.SERVICES.ARC.TIMEOUT]: z.coerce
      .number()
      .min(1000)
      .max(30000)
      .default(DEFAULT_VALUES.ARC_SERVICE_TIMEOUT)
      .optional(),
    [ENV_KEYS.SERVER.SERVICES.ARC.API_KEY]: z.string().min(1).optional(), // 서비스 간 인증용 API 키


    // ===== AI Providers / Routing =====
    [ENV_KEYS.SERVER.SERVICES.AI.OPENAI.API_KEY]: z.string().min(1).optional(),
    [ENV_KEYS.SERVER.SERVICES.AI.OPENAI.BASE_URL]: z.string().url().optional(),
    [ENV_KEYS.SERVER.SERVICES.AI.OPENROUTER.API_KEY]: z.string().optional(),
    [ENV_KEYS.SERVER.SERVICES.AI.CHAT.MODEL_ALIAS]: z
      .enum(['chat.low', 'chat.medium', 'chat.high', 'note.default', 'summary.default'])
      .optional(),
    
    // ===== Payments (Order Signing - Stateless) =====
    [ENV_KEYS.SERVER.SERVICES.PAYMENTS.ORDER.SIGNING_SECRET]: z
      .string()
      .min(32, 'ORDER_SIGNING_SECRET must be at least 32 characters')
      .optional(),
    [ENV_KEYS.SERVER.SERVICES.PAYMENTS.ORDER.ORDER_ID_TTL_MS]: z.coerce
      .number()
      .min(60000)
      .max(24 * 60 * 60 * 1000)
      .default(10 * 60 * 1000)
      .optional(),
    // ===== Gateway JWT (WS 인증용) =====
    [ENV_KEYS.SERVER.SERVICES.GATEWAY.JWT.PRIVATE_KEY]: z.string().min(1).optional(),
    [ENV_KEYS.SERVER.SERVICES.GATEWAY.JWT.ISSUER]: z.string().min(1).optional(),
    [ENV_KEYS.SERVER.SERVICES.GATEWAY.JWT.AUDIENCE]: z.string().min(1).optional(),
  })
  .loose();

// ==================== 통합 환경변수 스키마 (서버 전용) ====================

export const envSchema = serverEnvSchema
  .extend({
    [ENV_KEYS.CLIENT.APP.URL]: z.string().url().optional(),
  })
  .loose();

// ==================== 스키마 타입 추출 ====================

export type ClientEnvInput = z.input<typeof clientEnvSchema>;
export type ClientEnvOutput = z.output<typeof clientEnvSchema>;
export type ServerEnvInput = z.input<typeof serverEnvSchema>;
export type ServerEnvOutput = z.output<typeof serverEnvSchema>;
export type EnvInput = z.input<typeof envSchema>;
export type EnvOutput = z.output<typeof envSchema>;

// ==================== 환경 체크 헬퍼 타입 ====================

export interface EnvironmentFlags {
  readonly isDevelopment: boolean;
  readonly isProduction: boolean;
  readonly isTest: boolean;
}

// ==================== 환경변수 검증 헬퍼 함수 ====================

/**
 * 클라이언트 환경변수 검증
 * @param env - 검증할 환경변수 객체
 * @returns 검증된 환경변수
 */
export function validateClientEnv(
  env: Record<string, string | undefined>
): ClientEnvOutput {
  const result = clientEnvSchema.safeParse(env);

  if (!result.success) {
    const errors = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Client environment validation failed:\n${errors}`);
  }

  return result.data;
}

/**
 * 서버 환경변수 검증
 * @param env - 검증할 환경변수 객체
 * @returns 검증된 환경변수
 */
export function validateServerEnv(
  env: Record<string, string | undefined>
): ServerEnvOutput {
  const result = serverEnvSchema.safeParse(env);

  if (!result.success) {
    const errors = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Server environment validation failed:\n${errors}`);
  }

  return result.data;
}

/**
 * 통합 환경변수 검증 (서버 전용)
 * @param env - 검증할 환경변수 객체
 * @returns 검증된 환경변수
 */
export function validateEnv(
  env: Record<string, string | undefined>
): EnvOutput {
  const result = envSchema.safeParse(env);

  if (!result.success) {
    const errors = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Environment validation failed:\n${errors}`);
  }

  return result.data;
}

/**
 * 환경변수 검증 결과 타입
 */
export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: string[];
}

/**
 * 안전한 환경변수 검증 (예외 없음)
 * @param env - 검증할 환경변수 객체
 * @param schema - 사용할 스키마
 * @returns 검증 결과
 */
export function safeValidateEnv<T>(
  env: Record<string, string | undefined>,
  schema: z.ZodSchema<T>
): ValidationResult<T> {
  const result = schema.safeParse(env);

  if (result.success) {
    return {
      success: true,
      data: result.data,
    };
  }

  return {
    success: false,
    errors: result.error.issues.map(
      (issue) => `${issue.path.join('.')}: ${issue.message}`
    ),
  };
}
