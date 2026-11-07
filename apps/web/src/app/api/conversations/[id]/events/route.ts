import { apiUser } from "@/server/auth";
import { chatDeps, sse } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const POLL_MS = 1000;
const MAX_MS = 5 * 60 * 1000; // o cliente reconecta sozinho depois disso

/**
 * Atualizações em tempo real de uma conversa (mensagens novas e mudança de estado).
 * Usado pelo funcionário (para ver o analista) e pelo console (para ver o funcionário).
 */
export async function GET(req: Request, ctx: Ctx) {
  const user = await apiUser();
  if (user instanceof Response) return user;
  const id = Number((await ctx.params).id);
  const { store } = chatDeps(req);
  const conv = store.get(id);
  if (!conv || (user.role === "employee" && conv.employee.id !== user.id)) {
    return Response.json({ error: "Conversa não encontrada." }, { status: 404 });
  }

  let lastId = Number(new URL(req.url).searchParams.get("after") ?? 0);
  let lastState = "";
  return sse(async (send, signal) => {
    const started = Date.now();
    while (!signal.aborted && Date.now() - started < MAX_MS) {
      const messages = store.messages(id, lastId);
      const conversation = store.get(id)!;
      const state = `${conversation.status}|${conversation.assignedAnalyst?.id ?? ""}|${conversation.updatedAt}`;
      if (messages.length || state !== lastState) {
        lastId = messages.at(-1)?.id ?? lastId;
        lastState = state;
        send({ type: "update", conversation, messages, drafts: store.drafts(id) });
      }
      await new Promise((r) => setTimeout(r, POLL_MS));
    }
  }, req);
}
