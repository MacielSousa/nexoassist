import { handleServiceDesk, serviceDeskOptions } from "@/service-desk";

// Serviço de chamados simulado exposto por HTTP. O agent o acessa só por aqui.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ path: string[] }> };

async function handle(req: Request, ctx: Ctx) {
  const { path } = await ctx.params;
  return handleServiceDesk(req, path, serviceDeskOptions());
}

export { handle as GET, handle as POST };
