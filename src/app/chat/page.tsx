import { ChatView } from "@/components/chat/chat-view";
import { requireUser } from "@/server/auth";
import { appDb } from "@/server/db";
import { ConversationStore } from "@/server/conversations";

export const dynamic = "force-dynamic";

export default async function ChatPage() {
  const user = await requireUser("employee");
  const store = new ConversationStore(appDb());
  const snapshot = store.snapshot(store.activeOrCreate(user.id).id);
  return <ChatView user={user} initial={snapshot} />;
}
