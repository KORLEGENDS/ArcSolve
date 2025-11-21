import { generateId, type UIMessage } from "ai";
import sql from "./db";

export interface Chat {
  id: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 새 채팅 생성
 */
export async function createChat(userId: string = "default"): Promise<string> {
  const chatId = generateId();

  await sql`
    INSERT INTO chats (id, user_id)
    VALUES (${chatId}, ${userId})
  `;

  return chatId;
}

/**
 * 채팅 메시지 저장
 */
export async function saveChat({
  chatId,
  messages,
}: {
  chatId: string;
  messages: UIMessage[];
}): Promise<void> {
  // 트랜잭션으로 메시지 저장
  await sql.begin(async (sql) => {
    // 기존 메시지 삭제 후 새로 저장
    await sql`DELETE FROM chat_messages WHERE chat_id = ${chatId}`;

    // 새 메시지들 삽입 (UPSERT 사용하여 중복 방지)
    if (messages.length > 0) {
      const values = messages
        .filter((msg) => msg.id && msg.role) // 유효한 메시지만 필터링
        .map((msg) => ({
          id: msg.id,
          chat_id: chatId,
          role: msg.role,
          content: JSON.stringify(msg),
        }));

      // 배치 INSERT with UPSERT (중복 시 업데이트)
      if (values.length > 0) {
        for (const value of values) {
          await sql`
            INSERT INTO chat_messages (id, chat_id, role, content)
            VALUES (${value.id}, ${value.chat_id}, ${value.role}, ${value.content}::jsonb)
            ON CONFLICT (id) DO UPDATE SET
              chat_id = EXCLUDED.chat_id,
              role = EXCLUDED.role,
              content = EXCLUDED.content
          `;
        }
      }
    }

    // 채팅 업데이트 시간 갱신
    await sql`
      UPDATE chats
      SET updated_at = NOW()
      WHERE id = ${chatId}
    `;
  });
}

/**
 * 채팅 메시지 불러오기
 */
export async function loadChat(chatId: string): Promise<UIMessage[]> {
  const messages = await sql`
    SELECT content
    FROM chat_messages
    WHERE chat_id = ${chatId}
    ORDER BY created_at ASC
  `;

  // JSONB 파싱 처리
  return messages.map((row) => {
    const content = row.content;
    // 이미 객체인 경우
    if (typeof content === "object" && content !== null) {
      return content as UIMessage;
    }
    // 문자열인 경우 JSON 파싱
    if (typeof content === "string") {
      try {
        return JSON.parse(content) as UIMessage;
      } catch (error) {
        console.error("메시지 파싱 실패:", error, content);
        throw new Error(`Invalid message format: ${error}`);
      }
    }
    throw new Error(`Unexpected content type: ${typeof content}`);
  });
}

/**
 * 사용자의 채팅 목록 불러오기
 */
export async function loadUserChats(
  userId: string = "default",
): Promise<Chat[]> {
  const chats = await sql`
    SELECT id, user_id, created_at, updated_at
    FROM chats
    WHERE user_id = ${userId}
    ORDER BY updated_at DESC
  `;

  return chats.map((row) => ({
    id: row.id,
    userId: row.user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

/**
 * 채팅 삭제
 */
export async function deleteChat(chatId: string): Promise<void> {
  await sql`DELETE FROM chats WHERE id = ${chatId}`;
}

