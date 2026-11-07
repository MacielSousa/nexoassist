import { cookies, headers as incomingHeaders } from "next/headers";
import { redirect } from "next/navigation";
import { ACCESS_COOKIE, API_URL, forwardedFor } from "./session";
import { can, type Permission, type User } from "./types";

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
      ...forwardedFor(await incomingHeaders()),
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

/** Tela inicial conforme as permissões (a primeira que a pessoa pode usar). */
export function homeFor(user: User): string {
  if (can(user, "users.manage")) return "/admin/usuarios";
  if (can(user, "console.view")) return "/console";
  if (can(user, "chat.use")) return "/chat";
  if (can(user, "reports.view")) return "/relatorios";
  if (can(user, "users.view")) return "/admin/usuarios";
  if (can(user, "roles.manage")) return "/admin/roles";
  return "/perfil";
}

/** Exige sessão e, se informadas, pelo menos uma das permissões. Redireciona caso contrário. */
export async function requireUser(...permissions: Permission[]): Promise<User> {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (permissions.length && !can(user, ...permissions)) redirect(homeFor(user));
  return user;
}
