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
