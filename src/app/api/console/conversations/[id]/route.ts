import { z } from "zod";
import { apiUser } from "@/server/auth";
import { ApiError, closeConversation, giveBackToAgent, sendAnalystMessage, takeOver } from "@/server/chat";
import { chatDeps, handleErrors } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: Ctx) {
  return handleErrors(async () => {
    const user = await apiUser("analyst");
    if (user instanceof Response) return user;
    const id = Number((await ctx.params).id);
    const { store } = chatDeps(req);
    if (!store.get(id)) throw new ApiError(404, "Conversa não encontrada.");
    return Response.json(store.snapshot(id));
  });
}

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("take") }),
  z.object({ action: z.literal("return") }),
  z.object({ action: z.literal("close") }),
  z.object({ action: z.literal("message"), text: z.string() }),
]);

export async function POST(req: Request, ctx: Ctx) {
  return handleErrors(async () => {
    const user = await apiUser("analyst");
    if (user instanceof Response) return user;
    const id = Number((await ctx.params).id);
    const parsed = actionSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new ApiError(422, "Ação inválida.");
    const deps = chatDeps(req);
    const body = parsed.data;
    switch (body.action) {
      case "take":
        return Response.json(await takeOver(deps, user, id));
      case "return":
        return Response.json(giveBackToAgent(deps, user, id));
      case "close":
        return Response.json(closeConversation(deps, user, id));
      case "message":
        return Response.json(sendAnalystMessage(deps, user, id, body.text));
    }
  });
}
