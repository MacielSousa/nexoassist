"use server";

import { cookies, headers as incomingHeaders } from "next/headers";
import { redirect } from "next/navigation";
import { homeFor } from "@/lib/api";
import { ACCESS_COOKIE, ACCESS_MAX_AGE, API_URL, cookieOptions, forwardedFor, REFRESH_COOKIE, REFRESH_MAX_AGE } from "@/lib/session";
import type { User } from "@/lib/types";

export interface LoginState {
  error?: string;
  email?: string;
}

export async function login(_prev: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  if (!email || !password) return { error: "Informe e-mail e senha.", email };

  const res = await fetch(`${API_URL}/sessions`, {
    method: "POST",
    // O IP de quem tenta entrar: o limite de tentativas é por pessoa, não pelo servidor do Next.
    headers: { "content-type": "application/json", ...forwardedFor(await incomingHeaders()) },
    body: JSON.stringify({ email, password }),
  }).catch(() => null);
  if (!res) return { error: "Não foi possível falar com o servidor. Tente de novo em instantes.", email };

  const data = (await res.json().catch(() => ({}))) as { token?: string; refreshToken?: string; user?: User; message?: string };
  if (!res.ok || !data.token || !data.refreshToken || !data.user) {
    return { error: data.message ?? "Não foi possível entrar.", email };
  }

  const remember = form.get("remember") === "on";
  const jar = await cookies();
  jar.set(ACCESS_COOKIE, data.token, cookieOptions(ACCESS_MAX_AGE));
  // Sem "manter conectado", o refresh token dura só a sessão do navegador.
  const refreshOptions = cookieOptions(REFRESH_MAX_AGE);
  jar.set(REFRESH_COOKIE, data.refreshToken, remember ? refreshOptions : { ...refreshOptions, maxAge: undefined });
  redirect(homeFor(data.user));
}

export async function logout() {
  const jar = await cookies();
  const refreshToken = jar.get(REFRESH_COOKIE)?.value;
  if (refreshToken) {
    await fetch(`${API_URL}/sessions/logout`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    }).catch(() => undefined);
  }
  jar.delete(ACCESS_COOKIE);
  jar.delete(REFRESH_COOKIE);
  redirect("/login");
}
