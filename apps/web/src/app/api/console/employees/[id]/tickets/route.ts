import { toTicketView } from "@/agent/context";
import { ServiceDeskUnavailableError } from "@/agent/service-desk-client";
import { apiUser } from "@/server/auth";
import { chatDeps, handleErrors } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Chamados de um funcionário, para o painel lateral do console. Só analistas. */
export async function GET(req: Request, ctx: Ctx) {
  return handleErrors(async () => {
    const user = await apiUser("analyst");
    if (user instanceof Response) return user;
    const employeeId = decodeURIComponent((await ctx.params).id);
    try {
      const tickets = await chatDeps(req).clientFor({ id: user.id, role: "analyst" }).listTickets("all", employeeId);
      const now = new Date();
      return Response.json({ tickets: tickets.map((t) => ({ ...toTicketView(t, now), resolvedAt: t.resolvedAt, lastComment: t.comments.at(-1) ?? null })) });
    } catch (err) {
      if (err instanceof ServiceDeskUnavailableError) {
        return Response.json({ error: "Sistema de chamados indisponível. Tentando de novo…" }, { status: 503 });
      }
      throw err;
    }
  });
}
