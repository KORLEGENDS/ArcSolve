/**
 * API 에러 코드 및 응답 상수 정의
 * API 요청 처리 및 에러 응답 표준화
 */

// ==================== 에러 코드 ====================

export const ERROR_CODES = {
  // 인증 관련
  AUTH: {
    UNAUTHORIZED: 'AUTH003',
  },
} as const;

// ==================== HTTP 상태 코드 매핑 ====================

export const ERROR_STATUS_MAP = {
  // 4xx Client Errors
  [ERROR_CODES.AUTH.UNAUTHORIZED]: 401,
} as const;

// ==================== 다국어 에러 메시지 ====================

const ERROR_MESSAGES = {
  // 기본 메시지
  DEFAULT: {
    ko: '알 수 없는 오류가 발생했습니다.',
    en: 'An unknown error occurred.',
  },

  // 인증 관련
  AUTH: {
    UNAUTHORIZED: {
      ko: '인증이 필요합니다.',
      en: 'Authentication required.',
    },
  },
} as const;

// ==================== 에러 응답 헬퍼 함수 ====================

/**
 * 에러 코드로부터 해당하는 메시지를 가져옵니다
 */
export function getErrorMessage(errorCode: string): { ko: string; en: string } {
  // ERROR_CODES에서 해당 에러 코드 찾기
  for (const category of Object.values(ERROR_CODES)) {
    for (const [key, code] of Object.entries(category)) {
      if (code === errorCode) {
        // ERROR_MESSAGES에서 해당 메시지 찾기
        const categoryName = Object.keys(ERROR_CODES).find(
          (cat) => ERROR_CODES[cat as keyof typeof ERROR_CODES] === category
        ) as keyof typeof ERROR_MESSAGES;

        const categoryMessages = ERROR_MESSAGES[categoryName];
        if (
          categoryName &&
          categoryMessages?.[key as keyof typeof categoryMessages]
        ) {
          return categoryMessages[key as keyof typeof categoryMessages] as {
            ko: string;
            en: string;
          };
        }
      }
    }
  }

  // 기본 메시지 반환
  return ERROR_MESSAGES.DEFAULT;
}

/**
 * Next.js 미들웨어용 에러 응답 생성
 */
function createMiddlewareErrorResponse(
  errorCode: string,
  message: { ko: string; en: string },
  statusCode: number,
  locale: 'ko' | 'en' = 'ko'
): Response {
  return new Response(
    JSON.stringify({
      error: {
        code: errorCode,
        message: message[locale],
      },
    }),
    {
      status: statusCode,
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );
}

/**
 * 미들웨어용 에러 코드 응답 생성
 */
export function getMiddlewareErrorResponse(
  errorCode: string,
  locale: 'ko' | 'en' = 'ko'
): Response {
  const statusCode =
    (ERROR_STATUS_MAP as Record<string, number>)[errorCode] || 500;
  const message = getErrorMessage(errorCode);
  return createMiddlewareErrorResponse(errorCode, message, statusCode, locale);
}

// ==================== 에러 타입 정의 ====================

export type Locale = 'ko' | 'en';
