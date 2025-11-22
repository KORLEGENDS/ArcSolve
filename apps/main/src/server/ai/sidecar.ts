const SIDECAR_BASE_URL =
  process.env.SIDECAR_BASE_URL ??
  process.env.NEXT_PUBLIC_SIDECAR_BASE_URL ??
  "http://localhost:8000";

/**
 * 사이드카 FastAPI 서버로 POST 요청을 보내는 공통 유틸리티.
 * - path: "/tools/embed-search" 와 같은 절대 경로
 * - body: JSON 직렬화 가능한 페이로드
 */
async function callSidecar<T>(path: string, body: unknown): Promise<T> {
  const url = new URL(path, SIDECAR_BASE_URL).toString();

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    // FastAPI는 기본적으로 {"detail": "..."} 형태의 JSON 에러를 반환하므로,
    // 가능하면 JSON을 먼저 파싱해 디버깅에 유용한 메시지를 노출한다.
    let message = "";
    try {
      const data = (await res.json()) as { detail?: unknown };
      if (data && typeof data.detail !== "undefined") {
        message =
          typeof data.detail === "string"
            ? data.detail
            : JSON.stringify(data.detail);
      }
    } catch {
      message = await res.text().catch(() => "");
    }
    throw new Error(
      `Sidecar 요청 실패 (${res.status} ${res.statusText}): ${message}`,
    );
  }

  return (await res.json()) as T;
}

export type EmbedSearchResultItem = {
  document_id: string;
  document_content_id: string;
  document_name: string | null;
  document_path: string;
  document_chunk_id: string;
  position: number | null;
  chunk_content: string;
  similarity: number;
};

export type TextSearchResultItem = {
  document_id: string;
  document_content_id: string;
  document_name: string | null;
  document_path: string;
  document_chunk_id: string;
  position: number | null;
  chunk_content: string;
  rank: number;
};

export type TreeListItem = {
  document_id: string;
  name: string | null;
  path: string;
  kind: string;
  level: number;
  relative_path: string;
};

export async function callEmbedSearchTool(args: {
  userId: string;
  query: string;
  topK?: number;
}): Promise<EmbedSearchResultItem[]> {
  const { userId, query, topK = 5 } = args;

  return callSidecar<EmbedSearchResultItem[]>("/tools/embed-search", {
    user_id: userId,
    query,
    top_k: topK,
    path_prefix: null,
  });
}

export async function callTextSearchTool(args: {
  userId: string;
  query: string;
  topK?: number;
}): Promise<TextSearchResultItem[]> {
  const { userId, query, topK = 5 } = args;

  return callSidecar<TextSearchResultItem[]>("/tools/text-search", {
    user_id: userId,
    query,
    top_k: topK,
    path_prefix: null,
  });
}

export async function callTreeListTool(args: {
  userId: string;
  rootPath?: string;
  maxDepth?: number;
}): Promise<TreeListItem[]> {
  const { userId, rootPath, maxDepth = 4 } = args;

  return callSidecar<TreeListItem[]>("/tools/tree-list", {
    user_id: userId,
    root_path: rootPath || undefined, // 빈 문자열이면 undefined로 전달하여 사이드카가 모든 문서 조회
    max_depth: maxDepth,
  });
}


