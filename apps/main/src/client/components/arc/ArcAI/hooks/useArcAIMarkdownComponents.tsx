"use client";

import { cn } from "@/client/components/ui/utils";
import type { ReactElement } from "react";
import { isValidElement } from "react";
import type { Options } from "react-markdown";
import { CodeBlock, CodeBlockCopyButton } from "../components/ArcAIElements/code-block";
import styles from "./useArcAIMarkdownComponents.module.css";

// React 엘리먼트로부터 string child 를 안전하게 추출
function getStringChildFromElement(element: unknown): string | null {
  if (!isValidElement(element)) {
    return null;
  }

  const props = (element as ReactElement<{ children?: unknown }>).props;
  const child = props?.children;

  return typeof child === "string" ? child : null;
}

const components: Options["components"] = {
  p: ({ node: _node, children, className, ...props }) => (
    <p
      className={cn(styles.markdownParagraph, className)}
      {...props}
    >
      {children}
    </p>
  ),
  ol: ({ node: _node, children, className, ...props }) => (
    <ol
      className={cn(styles.markdownOrderedList, className)}
      {...props}
    >
      {children}
    </ol>
  ),
  li: ({ node: _node, children, className, ...props }) => (
    <li
      className={cn(styles.markdownListItem, className)}
      {...props}
    >
      {children}
    </li>
  ),
  ul: ({ node: _node, children, className, ...props }) => (
    <ul
      className={cn(styles.markdownUnorderedList, className)}
      {...props}
    >
      {children}
    </ul>
  ),
  hr: ({ node: _node, className, ...props }) => (
    <hr
      className={cn(styles.markdownHr, className)}
      {...props}
    />
  ),
  strong: ({ node: _node, children, className, ...props }) => (
    <span
      className={cn(styles.markdownStrong, className)}
      {...props}
    >
      {children}
    </span>
  ),
  a: ({ node: _node, children, className, ...props }) => (
    <a
      className={cn(styles.markdownLink, className)}
      rel="noreferrer"
      target="_blank"
      {...props}
    >
      {children}
    </a>
  ),
  h1: ({ node: _node, children, className, ...props }) => (
    <h1
      className={cn(styles.markdownHeading1, className)}
      {...props}
    >
      {children}
    </h1>
  ),
  h2: ({ node: _node, children, className, ...props }) => (
    <h2
      className={cn(styles.markdownHeading2, className)}
      {...props}
    >
      {children}
    </h2>
  ),
  h3: ({ node: _node, children, className, ...props }) => (
    <h3
      className={cn(styles.markdownHeading3, className)}
      {...props}
    >
      {children}
    </h3>
  ),
  h4: ({ node: _node, children, className, ...props }) => (
    <h4
      className={cn(styles.markdownHeading4, className)}
      {...props}
    >
      {children}
    </h4>
  ),
  h5: ({ node: _node, children, className, ...props }) => (
    <h5
      className={cn(styles.markdownHeading5, className)}
      {...props}
    >
      {children}
    </h5>
  ),
  h6: ({ node: _node, children, className, ...props }) => (
    <h6
      className={cn(styles.markdownHeading6, className)}
      {...props}
    >
      {children}
    </h6>
  ),
  table: ({ node: _node, children, className, ...props }) => (
    <div className={styles.markdownTableWrapper}>
      <table
        className={cn(styles.markdownTable, className)}
        {...props}
      >
        {children}
      </table>
    </div>
  ),
  thead: ({ node: _node, children, className, ...props }) => (
    <thead
      className={cn(styles.markdownThead, className)}
      {...props}
    >
      {children}
    </thead>
  ),
  tbody: ({ node: _node, children, className, ...props }) => (
    <tbody
      className={cn(styles.markdownTbody, className)}
      {...props}
    >
      {children}
    </tbody>
  ),
  tr: ({ node: _node, children, className, ...props }) => (
    <tr
      className={cn(styles.markdownTr, className)}
      {...props}
    >
      {children}
    </tr>
  ),
  th: ({ node: _node, children, className, ...props }) => (
    <th
      className={cn(styles.markdownTh, className)}
      {...props}
    >
      {children}
    </th>
  ),
  td: ({ node: _node, children, className, ...props }) => (
    <td
      className={cn(styles.markdownTd, className)}
      {...props}
    >
      {children}
    </td>
  ),
  blockquote: ({ node: _node, children, className, ...props }) => (
    <blockquote
      className={cn(styles.markdownBlockquote, className)}
      {...props}
    >
      {children}
    </blockquote>
  ),
  code: ({ node, className, ...props }) => {
    const inline = node?.position?.start.line === node?.position?.end.line;

    if (!inline) {
      // 블록 코드는 pre 컴포넌트에서 처리
      return <code className={className} {...props} />;
    }

    return (
      <code
        className={cn(styles.markdownCodeInline, className)}
        {...props}
      />
    );
  },
  pre: ({ node, className, children }) => {
    let language = "javascript";

    if (typeof node?.properties?.className === "string") {
      language = node.properties.className.replace("language-", "");
    }

    // children 에서 코드 문자열 안전하게 추출
    let code = "";

    if (typeof children === "string") {
      code = children;
    } else {
      const stringChild = getStringChildFromElement(children);
      if (stringChild !== null) {
        code = stringChild;
      }
    }

    return (
      <CodeBlock
        className={cn(styles.markdownCodeBlock, className)}
        code={code}
        // Shiki 의 BundledLanguage 타입과 호환되도록 런타임 문자열을 단언
        language={language as any}
      >
        <CodeBlockCopyButton onCopy={() => {}} onError={() => {}} />
      </CodeBlock>
    );
  },
};

/**
 * ArcAI 전용 ReactMarkdown 컴포넌트 매핑
 *
 * - 타이포그래피(h1~h6, p, blockquote 등)
 * - 리스트/테이블 스타일링
 * - 인라인/블록 코드 렌더링 (CodeBlock + Copy 버튼)
 */
export function useArcAIMarkdownComponents(): Options["components"] {
  return components;
}


