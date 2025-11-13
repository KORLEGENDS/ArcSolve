/**
 * 환경변수 키 통합 관리 모듈
 * 중첩 구조로 환경변수 키를 체계적으로 관리하고 타입 안전성 제공
 */

// ==================== 중첩 구조 환경변수 키 정의 ====================

export const ENV_KEYS = {
  COMMON: {
    NODE_ENV: 'NODE_ENV',
  },
  CLIENT: {
    APP: {
      URL: 'NEXT_PUBLIC_APP_URL',
    },
    CHAT: {
      WS_URL: 'NEXT_PUBLIC_CHAT_WS_URL',
    },
    AUTH: {
      OAUTH: {
        KAKAO: {
          CLIENT_ID: 'NEXT_PUBLIC_KAKAO_CLIENT_ID',
        },
        NAVER: {
          CLIENT_ID: 'NEXT_PUBLIC_NAVER_CLIENT_ID',
        },
      },
    },
    PAYMENTS: {
      ORDER: {
        ORDER_ID_TTL_MS: 'NEXT_PUBLIC_ORDER_ID_TTL_MS',
      },
    },
  },
  SERVER: {
    DATABASE: {
      POSTGRESQL: {
        HOST: 'POSTGRES_HOST',
        PORT: 'POSTGRES_PORT',
        USER: 'POSTGRES_USER',
        PASSWORD: 'POSTGRES_PASSWORD',
        DATABASE: 'POSTGRES_DB',
        TLS: {
          ENABLED: 'POSTGRES_TLS_ENABLED',
          SERVERNAME: 'POSTGRES_TLS_SERVERNAME',
        },
      },
      REDIS: {
        HOST: 'REDIS_HOST',
        PORT: 'REDIS_PORT',
        PASSWORD: 'REDIS_PASSWORD',
        TLS: {
          ENABLED: 'REDIS_TLS_ENABLED',
          SERVERNAME: 'REDIS_TLS_SERVERNAME',
        },
      },
    },
    AUTH: {
      CORE: {
        SECRET: 'AUTH_SECRET',
        DEBUG: 'AUTH_DEBUG',
      },
      OAUTH: {
        KAKAO: {
          ID: 'AUTH_KAKAO_ID',
          SECRET: 'AUTH_KAKAO_SECRET',
        },
        NAVER: {
          ID: 'AUTH_NAVER_ID',
          SECRET: 'AUTH_NAVER_SECRET',
        },
        COOKIE: {
          DOMAIN: 'AUTH_COOKIE_DOMAIN',
        },
      },
    },
    MONITORING: {
      RATE_LIMIT: {
        WINDOW_MS: 'RATE_LIMIT_WINDOW_MS',
        MAX_REQUESTS: 'RATE_LIMIT_MAX_REQUESTS',
      },
    },
    SERVICES: {
      ARC: {
        URL: 'ARC_SERVICE_URL',
        TIMEOUT: 'ARC_SERVICE_TIMEOUT',
        API_KEY: 'ARC_SERVICE_API_KEY',
      },
      AI: {
        OPENAI: {
          API_KEY: 'OPENAI_API_KEY',
          BASE_URL: 'OPENAI_BASE_URL',
        },
        OPENROUTER: {
          API_KEY: 'OPENROUTER_API_KEY',
        },
        CHAT: {
          MODEL_ALIAS: 'CHAT_MODEL_ALIAS',
        },
      },
      PAYMENTS: {
        ORDER: {
          SIGNING_SECRET: 'ORDER_SIGNING_SECRET',
          ORDER_ID_TTL_MS: 'ORDER_ID_TTL_MS',
        },
      },
      GATEWAY: {
        JWT: {
          PRIVATE_KEY: 'GATEWAY_JWT_PRIVATE_KEY',
          ISSUER: 'GATEWAY_JWT_ISSUER',
          AUDIENCE: 'GATEWAY_JWT_AUDIENCE',
        },
      },
    },
  },
} as const;

// ==================== 타입 정의 ====================

/**
 * 중첩된 객체에서 모든 경로를 추출하는 유틸리티 타입
 */
type PathsToStringProps<T> = T extends string
  ? []
  : {
      [K in Extract<keyof T, string>]: [K, ...PathsToStringProps<T[K]>];
    }[Extract<keyof T, string>];

/**
 * 경로 배열을 문자열로 변환하는 유틸리티 타입
 */
type Join<T extends readonly string[], D extends string> = T extends readonly [
  infer F,
  ...infer R,
]
  ? F extends string
    ? R extends readonly string[]
      ? R['length'] extends 0
        ? F
        : `${F}${D}${Join<R, D>}`
      : never
    : never
  : never;

/**
 * ENV_KEYS의 모든 가능한 경로 타입
 */
export type EnvKeyPath = Join<PathsToStringProps<typeof ENV_KEYS>, '.'>;

/**
 * 평탄화된 환경변수 키 타입
 */
export type FlattenedEnvKeys = Record<EnvKeyPath, string>;

// ==================== 유틸리티 함수 ====================

/**
 * 중첩된 ENV_KEYS를 평탄화하여 모든 환경변수 키를 추출
 */
export function flattenEnvKeys(
  obj: Record<string, unknown>,
  prefix = '',
  result: Record<string, string> = {}
): Record<string, string> {
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const newKey = prefix ? `${prefix}.${key}` : key;

      if (typeof obj[key] === 'object' && obj[key] !== null) {
        flattenEnvKeys(obj[key] as Record<string, unknown>, newKey, result);
      } else {
        result[newKey] = obj[key] as string;
      }
    }
  }
  return result;
}

/**
 * 경로를 사용하여 환경변수 키에 접근
 * @param path - 점으로 구분된 경로 (예: 'SERVER.AUTH.CORE.SECRET')
 * @returns 해당 경로의 환경변수 키
 */
export function getEnvKey(path: EnvKeyPath): string {
  const keys = path.split('.');
  let current: unknown = ENV_KEYS;

  for (const key of keys) {
    if (typeof current === 'object' && current !== null && key in current) {
      current = (current as Record<string, unknown>)[key];
    } else {
      throw new Error(`Invalid environment key path: ${path}`);
    }
  }

  if (typeof current !== 'string') {
    throw new Error(`Path ${path} does not point to a string value`);
  }

  return current;
}

// ==================== 키 그룹별 추출 ====================

/**
 * 클라이언트 환경변수 키만 추출 (평탄화된 형태)
 */
export const CLIENT_ENV_KEYS = ((): Record<string, string> => {
  const clientKeys: Record<string, string> = {};

  // COMMON 키들 (클라이언트에서도 사용 가능)
  const flattened = flattenEnvKeys(ENV_KEYS);

  // NODE_ENV (공통)
  clientKeys['NODE_ENV'] = ENV_KEYS.COMMON.NODE_ENV;

  // CLIENT 키들
  for (const [path, value] of Object.entries(flattened)) {
    if (path.startsWith('CLIENT.')) {
      const simplifiedKey = path.replace('CLIENT.', '').replace(/\./g, '_');
      clientKeys[simplifiedKey] = value;
    }
  }

  return clientKeys;
})();

/**
 * 서버 환경변수 키만 추출 (평탄화된 형태)
 */
export const SERVER_ENV_KEYS = ((): Record<string, string> => {
  const serverKeys: Record<string, string> = {};

  const flattened = flattenEnvKeys(ENV_KEYS);

  // 모든 키들을 포함 (서버는 모든 환경변수에 접근 가능)
  for (const [path, value] of Object.entries(flattened)) {
    const simplifiedKey = path
      .replace(/^(COMMON|CLIENT|SERVER)\./, '')
      .replace(/\./g, '_');
    serverKeys[simplifiedKey] = value;
  }

  return serverKeys;
})();

/**
 * 모든 환경변수 키 (평탄화된 형태)
 */
export const ALL_ENV_KEYS = flattenEnvKeys(ENV_KEYS);

// ==================== 타입 Export ====================

/**
 * 클라이언트 환경변수 키 타입
 */
export type ClientEnvironmentKey = keyof typeof CLIENT_ENV_KEYS;

/**
 * 서버 환경변수 키 타입
 */
export type ServerEnvironmentKey = keyof typeof SERVER_ENV_KEYS;
