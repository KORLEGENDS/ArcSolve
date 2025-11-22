"use client";

import type { Options } from "react-markdown";
import type { StreamdownProps } from "streamdown";
import { useArcAIAnimatedMarkdown } from "./useArcAIAnimatedMarkdown";
import { useArcAIMarkdownComponents } from "./useArcAIMarkdownComponents";
import { useArcAIMarkdownPlugins } from "./useArcAIMarkdownPlugins";
import { useArcAIMarkdownSecurity } from "./useArcAIMarkdownSecurity";

export interface UseArcAIMarkdownParams {
  content?: string;
  enableAnimation?: boolean;
  granularity?: "word" | "grapheme";
}

export type UseArcAIMarkdownResult = Pick<
  StreamdownProps,
  | "children"
  | "components"
  | "remarkPlugins"
  | "rehypePlugins"
  | "urlTransform"
  | "parseIncompleteMarkdown"
  | "isAnimating"
>;

/**
 * ArcAI 메시지 전용 Streamdown 설정 훅
 *
 * - 애니메이션(페이드 인, 전역 배치 스케줄러)
 * - 보안(URL 스킴 필터링)
 * - 마크다운 플러그인(수식, GFM, 리스트 보정)
 * - 컴포넌트 스타일링(타이포그래피, 코드 블록 등)
 *
 * 호출 측에서는 반환값을 그대로 Streamdown 에 스프레드하면 된다.
 */
export function useArcAIMarkdown(
  params: UseArcAIMarkdownParams = {}
): UseArcAIMarkdownResult {
  const {
    content,
    enableAnimation = true,
    granularity = "word",
  } = params;

  const { displayedText, rehypeFadePlugin, isAnimating } =
    useArcAIAnimatedMarkdown({
      content,
      mode: enableAnimation ? "fade" : "none",
      granularity,
    });

  const { remarkPlugins, rehypePlugins } = useArcAIMarkdownPlugins({
    extraRehypePlugins: rehypeFadePlugin ? [rehypeFadePlugin] : undefined,
  });

  const components = useArcAIMarkdownComponents();
  const { urlTransform } = useArcAIMarkdownSecurity();

  return {
    children: displayedText as Options["children"],
    components,
    remarkPlugins,
    rehypePlugins,
    urlTransform,
    parseIncompleteMarkdown: true,
    isAnimating,
  };
}


