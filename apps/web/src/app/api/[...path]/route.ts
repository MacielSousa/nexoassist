import { cookies } from "next/headers";
import { ACCESS_COOKIE, API_URL } from "@/lib/session";

/**
 * Proxy para a API (BFF). Os componentes do navegador chamam /api/... no mesmo domínio;
 * aqui o token sai do cookie httpOnly e vai no header Authorization. Respostas em
 * streaming (SSE) passam direto.
 */
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ path: string[] }> };

async function forward(request: Request, ctx: Ctx) {
  const { path } = await ctx.params;
  const url = new URL(request.url);
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;

  const headers = new Headers({ accept: request.headers.get("accept") ?? "application/json" });
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  if (token) headers.set("authorization", `Bearer ${token}`);

  const upstream = await fetch(`${API_URL}/${path.map(encodeURIComponent).join("/")}${url.search}`, {
    method: request.method,
    headers,
    // Binário (não texto): uploads multipart passam intactos.
    body: ["GET", "HEAD"].includes(request.method) ? undefined : await request.arrayBuffer(),
    signal: request.signal,
    cache: "no-store",
  }).catch(() => null);

  if (!upstream) return Response.json({ message: "API indisponível. Tente de novo em instantes." }, { status: 502 });

  const responseHeaders = new Headers({
    "content-type": upstream.headers.get("content-type") ?? "application/json",
    "cache-control": "no-cache, no-transform",
  });
  // Downloads (ex.: CSV de relatórios) mantêm o nome do arquivo.
  const disposition = upstream.headers.get("content-disposition");
  if (disposition) responseHeaders.set("content-disposition", disposition);
  return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
}

export { forward as GET, forward as POST, forward as PATCH, forward as PUT, forward as DELETE };
