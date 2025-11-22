"use client";

import { useCallback } from "react";
import type { Options } from "react-markdown";

export interface UseArcAIMarkdownSecurityResult {
  urlTransform: NonNullable<Options["urlTransform"]>;
}

/**
 * ArcAI 마크다운 렌더링 시 링크/이미지 URL을 필터링하기 위한 보안 유틸
 *
 * - javascript:, data:, vbscript: 등 위험한 스킴은 차단
 * - http(s), mailto, tel, 상대경로(/, ./, ../), 앵커(#id)는 허용
 */
export function useArcAIMarkdownSecurity(): UseArcAIMarkdownSecurityResult {
  const urlTransform = useCallback<NonNullable<Options["urlTransform"]>>(
    (url, _key) => {
      if (!url) return url;

      // 앵커(#section) 는 그대로 허용
      if (url.startsWith("#")) {
        return url;
      }

      // 상대 경로(/, ./, ../ 등)는 허용
      const hasScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(url);
      if (!hasScheme || url.startsWith("/")) {
        return url;
      }

      // 절대 URL 의 경우 안전한 프로토콜만 허용
      try {
        const parsed = new URL(url);
        const protocol = parsed.protocol.toLowerCase();

        if (
          protocol === "http:" ||
          protocol === "https:" ||
          protocol === "mailto:" ||
          protocol === "tel:"
        ) {
          return url;
        }

        // 그 외 프로토콜은 차단
        return null;
      } catch {
        // 파싱 실패 시 안전하게 차단
        return null;
      }
    },
    []
  );

  return { urlTransform };
}


