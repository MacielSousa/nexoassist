import { z } from "zod";
import { apiUser } from "@/server/auth";
import { ApiError, sendEmployeeMessage } from "@/server/chat";
import { chatDeps, handleErrors, sse } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Conversa em andamento do funcionário (cria uma se não houver). */
export async function GET(req: Request) {
  return handleErrors(async () => {
    const user = await apiUser("employee");
    if (user instanceof Response) return user;
    const { store } = chatDeps(req);
    return Response.json(store.snapshot(store.activeOrCreate(user.id).id));
  });
}

/** Envia uma mensagem e devolve a resposta do agent em streaming (SSE). */
export async function POST(req: Request) {
  const user = await apiUser("employee");
  if (user instanceof Response) return user;
  const parsed = z.object({ text: z.string() }).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Mensagem inválida." }, { status: 422 });
  const deps = chatDeps(req);
  return sse(async (send, signal) => {
    try {
      await sendEmployeeMessage(deps, user, parsed.data.text, send, signal);
    } catch (err) {
      if (err instanceof ApiError) send({ type: "error", error: err.message });
      else throw err;
    }
  }, req);
}
