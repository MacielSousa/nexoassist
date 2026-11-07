import { Console } from "@/components/console/console";
import { requireUser } from "@/server/auth";
import { appDb } from "@/server/db";
import { ConversationStore } from "@/server/conversations";

export const dynamic = "force-dynamic";

export default async function ConsolePage() {
  const analyst = await requireUser("analyst");
  const items = new ConversationStore(appDb()).list();
  return <Console analyst={analyst} initialItems={items} />;
}
