"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { Pluggable } from "unified";

type HastNode = any;

// 로컬 스트리밍 애니메이션 모드
export type ArcAIAnimationMode = "fade" | "none";

export interface UseArcAIAnimatedMarkdownOptions {
  content?: string;
  mode?: ArcAIAnimationMode;
  granularity?: "word" | "grapheme";
}

export interface UseArcAIAnimatedMarkdownResult {
  displayedText: string;
  rehypeFadePlugin: Pluggable | null;
  isAnimating: boolean;
}

/**
 * 텍스트 노드를 단어/그래핌 단위로 잘라 span.fade-segment 로 감싸
 * CSS 애니메이션으로 점진적 표시를 할 수 있게 해 주는 rehype 플러그인 생성기
 *
 * - code / pre / math / script / style 등은 변경하지 않음
 * - granularity: "word" | "grapheme"
 */
function createRehypeFade(options: {
  delayMs: number;
  durationMs: number;
  granularity: "word" | "grapheme";
  perIndexDelayMs?: number;
}): Pluggable {
  const { delayMs, durationMs, granularity, perIndexDelayMs } = options;

  return function rehypeFade() {
    return function transformer(tree: HastNode) {
      let indexCounter = 0;

      const SKIP_TAGS = new Set([
        "code",
        "pre",
        "kbd",
        "samp",
        "math",
        "script",
        "style",
      ]);

      function isWhitespace(text: string): boolean {
        return /^\s+$/.test(text);
      }

      function segment(text: string): string[] {
        try {
          const SegCtor =
            typeof Intl !== "undefined" && (Intl as any).Segmenter
              ? (Intl as any).Segmenter
              : undefined;
          if (typeof SegCtor === "function") {
            const lang =
              typeof navigator !== "undefined" && (navigator as any).language
                ? (navigator as any).language
                : "en";
            const seg = new SegCtor(lang, { granularity });
            const it = seg.segment(text);
            return Array.from(it as any, (s: any) => s.segment);
          }
        } catch {
          // Intl.Segmenter 가 없거나 실패한 경우, 폴백 사용
        }

        if (granularity === "grapheme") {
          return Array.from(text);
        }

        return text.split(/(\s+)/g).filter((t) => t.length > 0);
      }

      function transformChildren(parent: HastNode, inCode: boolean) {
        if (!parent || !Array.isArray(parent.children)) return;
        const next: HastNode[] = [];

        for (const child of parent.children) {
          if (child.type === "element") {
            const tag = (child.tagName || "").toLowerCase();
            const passThrough = inCode || SKIP_TAGS.has(tag);
            transformChildren(child, passThrough);
            next.push(child);
            continue;
          }

          if (child.type === "text" && !inCode) {
            const tokens = segment(child.value as string);
            for (const tok of tokens) {
              if (isWhitespace(tok)) {
                next.push({ type: "text", value: tok });
              } else {
                const localIndex = indexCounter++;
                next.push({
                  type: "element",
                  tagName: "span",
                  properties: {
                    className: ["fade-segment"],
                    style: `animation-delay: ${
                      (perIndexDelayMs ?? delayMs) * localIndex
                    }ms; animation-duration: ${durationMs}ms;`,
                  },
                  children: [{ type: "text", value: tok }],
                });
              }
            }
            continue;
          }

          next.push(child);
        }

        parent.children = next;
      }

      transformChildren(tree, false);
      return tree;
    };
  };
}

// ===== 전역 배치 스케줄러 구현 =====
const globalSubscribers = new Set<() => void>();
let globalRafId: number | null = null;
let globalDirty = false;
let lastTickAt = 0;
const GLOBAL_MIN_INTERVAL_MS = 34; // 약 30fps

function globalTick() {
  globalRafId = null;
  const now =
    typeof performance !== "undefined" && performance.now
      ? performance.now()
      : Date.now();
  const elapsed = now - lastTickAt;

  if (elapsed < GLOBAL_MIN_INTERVAL_MS) {
    // 충분히 간격이 지나지 않았으면 다음 프레임으로 이월
    globalRafId =
      typeof window !== "undefined"
        ? window.requestAnimationFrame(globalTick)
        : null;
    return;
  }

  lastTickAt = now;
  // 더티 플래그 초기화 후 일괄 반영
  globalDirty = false;

  for (const apply of globalSubscribers) {
    apply();
  }

  // 반영 중 새 변경이 들어온 경우 다음 프레임 예약
  if (globalDirty && globalRafId == null && typeof window !== "undefined") {
    globalRafId = window.requestAnimationFrame(globalTick);
  }
}

function scheduleGlobalTick() {
  if (globalRafId == null && typeof window !== "undefined") {
    globalRafId = window.requestAnimationFrame(globalTick);
  }
}

export function markGlobalDirty() {
  globalDirty = true;
  scheduleGlobalTick();
}

function useGlobalBatchSubscription(
  latestContentRef: RefObject<string>,
  displayedTextRef: RefObject<string>,
  setDisplayedText: (value: string) => void
) {
  useEffect(() => {
    const apply = () => {
      const next = latestContentRef.current ?? "";
      if (next !== displayedTextRef.current) {
        displayedTextRef.current = next;
        setDisplayedText(next);
        // 상태가 변경되었으므로 다음 프레임에도 반영 기회를 주기 위해 더티 유지
        globalDirty = true;
      }
    };

    globalSubscribers.add(apply);
    // 초기 스케줄
    scheduleGlobalTick();

    return () => {
      globalSubscribers.delete(apply);
    };
  }, [latestContentRef, displayedTextRef, setDisplayedText]);
}

/**
 * ArcAI 전용 마크다운 애니메이션 훅
 *
 * - 여러 인스턴스가 동시에 스트리밍될 때 전역 배치 스케줄러로 상태 업데이트를 모아 렌더링 부담을 줄입니다.
 * - mode === "fade" 인 경우 rehype 플러그인을 통해 span.fade-segment 기반 페이드 인 애니메이션을 적용합니다.
 */
export function useArcAIAnimatedMarkdown(
  options: UseArcAIAnimatedMarkdownOptions
): UseArcAIAnimatedMarkdownResult {
  const { content, mode = "fade", granularity = "word" } = options;

  const [displayedText, setDisplayedText] = useState(content ?? "");
  const latestContentRef = useRef<string>(content ?? "");
  const displayedTextRef = useRef<string>(content ?? "");

  // 전역 배치 스케줄러 구독
  useGlobalBatchSubscription(latestContentRef, displayedTextRef, setDisplayedText);

  // 최신 콘텐츠만 ref에 보관하고, 전역 tick에서 일괄 반영
  useEffect(() => {
    latestContentRef.current = content ?? "";
    markGlobalDirty();
  }, [content]);

  // 시각적 폴리시를 위한 짧은 고정 페이드 시간
  const durationMs = useMemo(() => 120, []);
  const delayMs = 0;

  const rehypeFadePlugin = useMemo<Pluggable | null>(() => {
    if (mode !== "fade") {
      return null;
    }

    return createRehypeFade({
      delayMs,
      durationMs,
      granularity,
      perIndexDelayMs: 0,
    });
  }, [delayMs, durationMs, granularity, mode]);

  const isAnimating = mode === "fade";

  return {
    displayedText,
    rehypeFadePlugin,
    isAnimating,
  };
}


