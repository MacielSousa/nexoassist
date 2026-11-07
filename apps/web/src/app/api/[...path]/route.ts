import { cookies } from "next/headers";
import { ACCESS_COOKIE, API_URL, forwardedFor } from "@/lib/session";

/**
 * Proxy para a API (BFF). Os componentes do navegador chamam /api/... no mesmo domínio;
 * aqui o token sai do cookie httpOnly e vai no header Authorization. Respostas em
 * streaming (SSE) passam direto.
 */
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ path: string[] }> };

/** Cabeçalhos da API que precisam chegar ao navegador (downloads seguros, SSE, CSV). */
const PASS_THROUGH = ["content-disposition", "content-length", "x-content-type-options", "content-security-policy", "retry-after"];

async function forward(request: Request, ctx: Ctx) {
  const { path } = await ctx.params;
  // Só segmentos simples: nada de "." ou ".." para escapar do prefixo.
  if (path.some((segment) => segment === "." || segment === "..")) return Response.json({ message: "Caminho inválido." }, { status: 400 });

  // CSRF (defesa extra além do SameSite=Lax): escrita só a partir da própria origem.
  if (!["GET", "HEAD"].includes(request.method)) {
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin && origin !== `${request.headers.get("x-forwarded-proto") ?? "http"}://${request.headers.get("host")}`) {
      return Response.json({ message: "Origem não permitida." }, { status: 403 });
    }
  }

  const url = new URL(request.url);
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;

  const headers = new Headers({ accept: request.headers.get("accept") ?? "application/json" });
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  if (token) headers.set("authorization", `Bearer ${token}`);
  for (const [name, value] of Object.entries(forwardedFor(request.headers))) headers.set(name, value);

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
    "cache-control": upstream.headers.get("cache-control") ?? "no-cache, no-transform",
  });
  for (const name of PASS_THROUGH) {
    const value = upstream.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }
  // Padrões seguros quando a API não definiu nada mais restrito.
  responseHeaders.set("x-content-type-options", "nosniff");
  if (!responseHeaders.has("content-security-policy")) responseHeaders.set("content-security-policy", "default-src 'none'; frame-ancestors 'none'");
  return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
}

export { forward as GET, forward as POST, forward as PATCH, forward as PUT, forward as DELETE };
