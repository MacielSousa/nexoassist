import { ChatView } from "@/components/chat/chat-view";
import { apiFetch, requireUser } from "@/lib/api";
import type { ConversationSnapshot } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ChatPage() {
  const user = await requireUser("employee");
  const snapshot = await apiFetch<ConversationSnapshot>("/conversations/active");
  return <ChatView user={user} initial={snapshot} />;
}
