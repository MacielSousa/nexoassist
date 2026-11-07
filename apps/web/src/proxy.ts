import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_COOKIE, ACCESS_MAX_AGE, API_URL, cookieOptions, REFRESH_COOKIE, REFRESH_MAX_AGE, tokenExpiresAt } from "@/lib/session";

/**
 * Antes de cada página ou chamada /api: se o token de acesso venceu (ou vai vencer),
 * renova com o refresh token e atualiza os cookies. Assim as páginas e o proxy da API
 * sempre recebem um token válido, sem o usuário perceber.
 */
export async function proxy(request: NextRequest) {
  const access = request.cookies.get(ACCESS_COOKIE)?.value;
  const refresh = request.cookies.get(REFRESH_COOKIE)?.value;

  const fresh = access && tokenExpiresAt(access) - Date.now() > 30_000;
  if (fresh || !refresh) return NextResponse.next();

  const res = await fetch(`${API_URL}/sessions/refresh`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ refreshToken: refresh }),
  }).catch(() => null);

  if (!res?.ok) {
    // Sessão expirada: limpa os cookies; as páginas redirecionam para o login.
    request.cookies.delete(ACCESS_COOKIE);
    request.cookies.delete(REFRESH_COOKIE);
    const response = NextResponse.next({ request });
    response.cookies.delete(ACCESS_COOKIE);
    response.cookies.delete(REFRESH_COOKIE);
    return response;
  }

  const tokens = (await res.json()) as { token: string; refreshToken: string };
  // Atualiza a requisição (para a página atual) e a resposta (para o navegador).
  request.cookies.set(ACCESS_COOKIE, tokens.token);
  request.cookies.set(REFRESH_COOKIE, tokens.refreshToken);
  const response = NextResponse.next({ request });
  response.cookies.set(ACCESS_COOKIE, tokens.token, cookieOptions(ACCESS_MAX_AGE));
  response.cookies.set(REFRESH_COOKIE, tokens.refreshToken, cookieOptions(REFRESH_MAX_AGE));
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
