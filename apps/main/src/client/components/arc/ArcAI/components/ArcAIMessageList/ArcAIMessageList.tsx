"use client";

import { cn } from "@/client/components/ui/utils";
import type { UIMessage } from "ai";
import { useEffect, useRef } from "react";
import { useStickToBottomContext } from "use-stick-to-bottom";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "../ArcAIElements/conversation";
import { ResponsePreparing } from "../ArcAIElements/response-preparing";
import {
  Message,
  MessageContent,
  MessageResponse,
  MessageToolCall,
} from "../ArcAIMessage/ArcAIMessage";
import { ArcAIReasoning } from "../ArcAIReasoning/ArcAIReasoning";
import styles from "./ArcAIMessageList.module.css";

export type ArcAIMessageListProps = {
  messages: UIMessage[];
  className?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  /**
   * 이 값이 변경될 때마다 StickToBottom 컨테이너의 맨 아래로 스크롤합니다.
   * - 예: 마지막 user 메시지 id, scrollKey 등
   */
  scrollTrigger?: unknown;
  /**
   * AI SDK useChat 의 상태
   * - 'submitted' | 'streaming' | 'ready' | 'error'
   * - 선택적: 전달되지 않으면 준비 인디케이터를 표시하지 않습니다.
   */
  aiStatus?: "submitted" | "streaming" | "ready" | "error";
};

type ArcAIMessageSection = {
  id: string;
  user?: UIMessage;
  assistants: UIMessage[];
};

export const ArcAIMessageList = ({
  messages,
  className,
  emptyTitle = "메시지가 아직 없습니다",
  emptyDescription = "메시지를 입력하면 이 영역에 대화가 표시됩니다.",
  scrollTrigger,
  aiStatus,
}: ArcAIMessageListProps) => {
  const sections = groupMessagesToSections(messages);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const lastSectionRef = useRef<HTMLElement | null>(null);

  // 첫 assistant 토큰이 도착하기 전(요청만 보낸 상태) 여부
  const lastMessage = messages[messages.length - 1];
  const isAwaitingFirstAssistant =
    aiStatus === "submitted" && lastMessage?.role === "user";

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const viewportHeight = root.clientHeight;
    const minHeight = Math.max(0, viewportHeight - 260);

    root.style.setProperty("--last-section-min", `${minHeight}px`);
  }, [sections.length]);

  if (sections.length === 0) {
    return (
      <div ref={rootRef} className={cn(styles.root, className)}>
        <Conversation>
          {typeof scrollTrigger !== "undefined" && (
            <AutoScrollOnTrigger trigger={scrollTrigger} />
          )}
          <ConversationContent>
            <ConversationEmptyState
              title={emptyTitle}
              description={emptyDescription}
            />
          </ConversationContent>
        </Conversation>
      </div>
    );
  }

  return (
    <div ref={rootRef} className={cn(styles.root, className)}>
      <Conversation>
        {typeof scrollTrigger !== "undefined" && (
          <AutoScrollOnTrigger trigger={scrollTrigger} />
        )}
        <ConversationContent className={styles.messageList}>
          {sections.map((section, index) => {
            const isLast = index === sections.length - 1;

            return (
              <section
                key={section.id}
                ref={isLast ? lastSectionRef : null}
                className={cn(
                  styles.section,
                  isLast &&
                    "isLastSection" in styles &&
                    (styles as Record<string, string>).isLastSection
                )}
              >
                {section.user && (
                  <div className={styles.sectionHeader}>
                    <Message from="user">
                      <MessageContent from="user">
                        <MessageResponse>
                          {section.user.parts
                            .filter(
                              (part: any): part is { type: "text"; text: string } =>
                                part.type === "text" &&
                                typeof part.text === "string"
                            )
                            .map((part: any) => part.text)
                            .join("\n\n")}
                        </MessageResponse>
                      </MessageContent>
                    </Message>
                  </div>
                )}

                <div className={styles.sectionContent}>
                  {section.assistants.map((assistant) => (
                    <Message key={assistant.id} from="assistant">
                      <MessageContent>
                        {assistant.parts.map((part: any, index: number) => {
                          if (
                            part.type === "text" &&
                            typeof part.text === "string"
                          ) {
                            return (
                              <MessageResponse
                                key={`${assistant.id}-text-${index}`}
                              >
                                {part.text}
                              </MessageResponse>
                            );
                          }

                          if (
                            typeof part.type === "string" &&
                            part.type.startsWith("tool-")
                          ) {
                            return (
                              <MessageToolCall
                                // ToolUIPart 에는 toolCallId 가 있을 수 있으므로 우선 사용
                                key={
                                  (part as any).toolCallId ??
                                  `${assistant.id}-tool-${index}`
                                }
                                part={part}
                              />
                            );
                          }

                          return null;
                        })}
                      </MessageContent>

                      {/* 메시지 메타데이터에 reasoningText 가 있는 경우, 추론 패널 표시 */}
                      <ArcAIReasoning
                        content={
                          (assistant as any).metadata?.reasoningText as
                            | string
                            | undefined
                        }
                      />
                    </Message>
                  ))}

                  {/* 마지막 user 메시지 직후, 아직 assistant 토큰이 하나도 오지 않은 상태라면
                      "생각 중" 인디케이터를 표시합니다. */}
                  {isLast &&
                    isAwaitingFirstAssistant &&
                    section.assistants.length === 0 && (
                      <div className={styles.preparing}>
                        <ResponsePreparing />
                      </div>
                    )}
                </div>
              </section>
            );
          })}
        </ConversationContent>

        <ConversationScrollButton />
      </Conversation>
    </div>
  );
};

type AutoScrollOnTriggerProps = {
  trigger: unknown;
};

const AutoScrollOnTrigger = ({ trigger }: AutoScrollOnTriggerProps) => {
  const { scrollToBottom } = useStickToBottomContext();

  useEffect(() => {
    scrollToBottom();
  }, [trigger, scrollToBottom]);

  return null;
};

function groupMessagesToSections(messages: UIMessage[]): ArcAIMessageSection[] {
  const sections: ArcAIMessageSection[] = [];
  let current: ArcAIMessageSection | null = null;

  for (const message of messages) {
    if (message.role === "user") {
      current = {
        id: message.id ?? `section-${sections.length}`,
        user: message,
        assistants: [],
      };
      sections.push(current);
      continue;
    }

    if (message.role === "assistant") {
      if (!current) {
        current = {
          id: message.id ?? `section-${sections.length}`,
          user: undefined,
          assistants: [message],
        };
        sections.push(current);
      } else {
        current.assistants.push(message);
      }
    }
  }

  return sections;
}

