import { apiUser } from "@/server/auth";
import { cancelDraft, confirmDraft } from "@/server/chat";
import { chatDeps, handleErrors } from "@/server/http";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string; action: string }> };

export async function POST(req: Request, ctx: Ctx) {
  return handleErrors(async () => {
    const user = await apiUser("employee");
    if (user instanceof Response) return user;
    const { id, action } = await ctx.params;
    const deps = chatDeps(req);
    if (action === "confirm") return Response.json(await confirmDraft(deps, user, id));
    if (action === "cancel") return Response.json(cancelDraft(deps, user, id));
    return Response.json({ error: "Ação inválida." }, { status: 404 });
  });
}
