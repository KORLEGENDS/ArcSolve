import { loadChat } from "@/server/ai/chat-store";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ aiId: string }> },
) {
  const { aiId } = await params;
  const messages = await loadChat(aiId);

  return Response.json({ messages });
}

