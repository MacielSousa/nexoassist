import { apiUser } from "@/server/auth";
import { startNewConversation } from "@/server/chat";
import { chatDeps, handleErrors } from "@/server/http";

export const runtime = "nodejs";

export async function POST(req: Request) {
  return handleErrors(async () => {
    const user = await apiUser("employee");
    if (user instanceof Response) return user;
    return Response.json(startNewConversation(chatDeps(req), user));
  });
}
