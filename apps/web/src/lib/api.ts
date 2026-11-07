import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ACCESS_COOKIE, API_URL } from "./session";
import type { User, UserRole } from "./types";

// Chamadas à API feitas pelo servidor do Next (páginas e server actions).

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
    cache: "no-store",
  });
  if (res.status === 204) return undefined as T;
  const data = (await res.json().catch(() => ({}))) as T & { message?: string };
  if (!res.ok) throw new ApiError(res.status, data.message ?? "Erro ao falar com a API.");
  return data;
}

/** Usuário logado, ou null se não houver sessão válida. */
export async function currentUser(): Promise<User | null> {
  try {
    return await apiFetch<User>("/users/me");
  } catch (err) {
    if (err instanceof ApiError && (err.status === 401 || err.status === 404)) return null;
    throw err;
  }
}

export function homeFor(role: UserRole) {
  return role === "employee" ? "/chat" : role === "analyst" ? "/console" : "/admin/usuarios";
}

/** Exige sessão (e, opcionalmente, um dos perfis). Redireciona caso contrário. */
export async function requireUser(...roles: UserRole[]): Promise<User> {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (roles.length && !roles.includes(user.role)) redirect(homeFor(user.role));
  return user;
}
