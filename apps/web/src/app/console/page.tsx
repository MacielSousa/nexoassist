import { Console } from "@/components/console/console";
import { apiFetch, requireUser } from "@/lib/api";
import type { ConsoleItem } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ConsolePage() {
  const analyst = await requireUser("console.view");
  const items = await apiFetch<ConsoleItem[]>("/console/conversations");
  return <Console analyst={analyst} initialItems={items} />;
}
