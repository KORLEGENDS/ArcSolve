import { createChat } from "@/server/ai/chat-store";
export async function POST() {
  const chatId = await createChat("default");

  return Response.json({ chatId });
}

