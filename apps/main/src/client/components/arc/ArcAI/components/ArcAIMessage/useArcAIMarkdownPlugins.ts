"use client";

import { useMemo } from "react";
import type { Pluggable } from "unified";
import type { Options } from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkFixSiblingListNesting from "./fix-sibling-list-nesting";

export interface UseArcAIMarkdownPluginsOptions {
  extraRemarkPlugins?: Pluggable[];
  extraRehypePlugins?: Pluggable[];
}

export interface UseArcAIMarkdownPluginsResult
  extends Pick<Options, "remarkPlugins" | "rehypePlugins"> {}

/**
 * ArcAI에서 공통으로 사용하는 remark/rehype 플러그인 세트
 *
 * - remarkGfm: GitHub Flavored Markdown
 * - remarkMath: 인라인/블록 수식
 * - remarkFixSiblingListNesting: LLM이 생성한 리스트 구조 보정
 * - rehypeKatex: KaTeX 렌더링
 * - extra* 인자를 통해 호출측에서 플러그인을 확장할 수 있음
 */
export function useArcAIMarkdownPlugins(
  options: UseArcAIMarkdownPluginsOptions = {}
): UseArcAIMarkdownPluginsResult {
  const { extraRemarkPlugins, extraRehypePlugins } = options;

  const remarkPlugins = useMemo<Pluggable[]>(() => {
    const base: Pluggable[] = [
      remarkGfm,
      remarkMath,
      remarkFixSiblingListNesting,
    ];
    return extraRemarkPlugins ? [...base, ...extraRemarkPlugins] : base;
  }, [extraRemarkPlugins]);

  const rehypePlugins = useMemo<Pluggable[]>(() => {
    const base: Pluggable[] = [rehypeKatex];
    return extraRehypePlugins ? [...base, ...extraRehypePlugins] : base;
  }, [extraRehypePlugins]);

  return {
    remarkPlugins,
    rehypePlugins,
  };
}


