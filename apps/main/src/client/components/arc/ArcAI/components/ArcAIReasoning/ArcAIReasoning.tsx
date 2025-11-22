"use client";

import { CollapsibleContent } from "@/client/components/ui/collapsible";
import { cn } from "@/client/components/ui/utils";
import type { ComponentProps } from "react";
import { Streamdown } from "streamdown";

import { useArcAIMarkdown } from "../../hooks/useArcAIMarkdown";
import {
  Reasoning,
  ReasoningTrigger,
} from "../ArcAIElements/reasoning";

export type ArcAIReasoningProps = {
  /**
   * 모델이 생성한 추론(Reasoning) 텍스트
   * - 마크다운 가능
   */
  content?: string;
  /**
   * 현재 메시지가 스트리밍 중인지 여부
   * - useChat().status === 'streaming' 등에서 파생
   */
  isStreaming?: boolean;
  /** 최초에 Reasoning 패널을 펼친 상태로 시작할지 여부 (기본값: true) */
  defaultOpen?: boolean;
} & Omit<ComponentProps<typeof CollapsibleContent>, "children">;

/**
 * ArcAI 전용 Reasoning 블록
 *
 * - 내부적으로 ArcAIElements 의 Reasoning / ReasoningTrigger 를 사용
 * - 본문은 useArcAIMarkdown + Streamdown 으로 MessageResponse 와 동일한
 *   스트리밍/애니메이션 설정을 공유합니다.
 */
export const ArcAIReasoning = ({
  content,
  isStreaming = false,
  defaultOpen = true,
  className,
  ...contentProps
}: ArcAIReasoningProps) => {
  // 추론 내용이 없으면 렌더하지 않음
  if (!content || content.trim().length === 0) {
    return null;
  }

  const markdown = useArcAIMarkdown({
    content,
    enableAnimation: true,
    granularity: "word",
  });

  const fadeStyle = `
.fade-segment {
  display: inline-block;
  opacity: 0;
  animation: var(--animate-ft-fadeIn);
  animation-fill-mode: forwards;
}
`.trim();

  return (
    <Reasoning
      defaultOpen={defaultOpen}
      isStreaming={isStreaming}
      className="not-prose mb-4"
    >
      <ReasoningTrigger />
      <CollapsibleContent
        className={cn(
          "mt-4 text-sm",
          "data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2 text-muted-foreground outline-none data-[state=closed]:animate-out data-[state=open]:animate-in",
          className,
        )}
        {...contentProps}
      >
        <style>{fadeStyle}</style>
        <Streamdown {...markdown} />
      </CollapsibleContent>
    </Reasoning>
  );
};


