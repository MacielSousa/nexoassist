// Nomes e opções dos cookies de sessão. Os tokens ficam em cookies httpOnly:
// o JavaScript do navegador nunca vê o JWT (só o servidor do Next, que repassa à API).

export const ACCESS_COOKIE = "nexo_access";
export const REFRESH_COOKIE = "nexo_refresh";

export const API_URL = process.env.API_URL ?? "http://localhost:3333";

export const cookieOptions = (maxAgeSeconds: number) => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production" && process.env.INSECURE_COOKIES !== "true",
  path: "/",
  maxAge: maxAgeSeconds,
});

/**
 * IP de quem fez a requisição, para a API aplicar os limites por pessoa e não pelo
 * servidor do Next. Usa o último valor do X-Forwarded-For (o salto que conectou no Next;
 * os anteriores podem ter sido forjados pelo cliente).
 */
export function forwardedFor(incoming: Headers): Record<string, string> {
  const ip = incoming.get("x-forwarded-for")?.split(",").pop()?.trim();
  return ip ? { "x-forwarded-for": ip } : {};
}

export const ACCESS_MAX_AGE = 15 * 60;
export const REFRESH_MAX_AGE = 30 * 24 * 60 * 60;

/** Lê o "exp" do JWT sem validar (quem valida é a API); só para saber se precisa renovar. */
export function tokenExpiresAt(token: string): number {
  try {
    const base64 = token.split(".")[1]!.replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(base64)) as { exp?: number };
    return (payload.exp ?? 0) * 1000;
  } catch {
    return 0;
  }
}
