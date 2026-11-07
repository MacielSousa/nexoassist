import { apiUser } from "@/server/auth";
import { chatDeps, handleErrors } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return handleErrors(async () => {
    const user = await apiUser("analyst");
    if (user instanceof Response) return user;
    return Response.json({ items: chatDeps(req).store.list() });
  });
}
