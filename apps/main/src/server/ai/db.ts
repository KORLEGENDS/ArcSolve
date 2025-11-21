import postgres from "postgres";

// 환경변수에서 데이터베이스 연결 정보 가져오기
const dbUser = process.env.POSTGRES_USER || "postgres";
const dbPassword = process.env.POSTGRES_PASSWORD || "postgres";
const dbName = process.env.POSTGRES_DB || "postgres";
const dbHost = process.env.POSTGRES_HOST || "localhost";
const dbPort = parseInt(process.env.POSTGRES_PORT || "5432", 10);

// PostgreSQL 연결 생성
const sql = postgres({
  host: dbHost,
  port: dbPort,
  database: dbName,
  username: dbUser,
  password: dbPassword,
  max: 10, // 최대 연결 수
});

// 채팅 테이블 초기화 함수
export async function initChatTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS chats (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      chat_id TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
      content JSONB NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_chat_messages_chat_id ON chat_messages(chat_id)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at)
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_chats_user_id ON chats(user_id)
  `;
}

export default sql;

