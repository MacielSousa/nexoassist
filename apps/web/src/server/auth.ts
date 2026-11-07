import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { appDb } from "./db";

// Sessão em cookie httpOnly assinado com HMAC. Sem estado no servidor; expira em 12 h.

export interface User {
  id: string;
  name: string;
  role: "employee" | "analyst";
  department: string;
  initials: string;
  avatarBg: string;
  avatarFg: string;
  passwordChangedAt: string;
}

const COOKIE = "nexo_session";
const TTL_MS = 12 * 60 * 60 * 1000;

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 32) return s;
  if (process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET precisa ter ao menos 32 caracteres.");
  return "dev-only-secret-do-not-use-in-production-0000";
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function encodeSession(userId: string, now = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ uid: userId, exp: now + TTL_MS })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function decodeSession(token: string | undefined, now = Date.now()): string | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const { uid, exp } = JSON.parse(Buffer.from(payload, "base64url").toString()) as { uid: string; exp: number };
    return exp > now ? uid : null;
  } catch {
    return null;
  }
}

interface UserRow {
  id: string;
  name: string;
  role: User["role"];
  department: string;
  initials: string;
  avatar_bg: string;
  avatar_fg: string;
  password_changed_at: string;
}

export function findUser(id: string): User | null {
  const row = appDb().prepare("SELECT * FROM users WHERE id = ?").get(id.trim().toLowerCase()) as UserRow | undefined;
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    department: row.department,
    initials: row.initials,
    avatarBg: row.avatar_bg,
    avatarFg: row.avatar_fg,
    passwordChangedAt: row.password_changed_at,
  };
}

export async function currentUser(): Promise<User | null> {
  const uid = decodeSession((await cookies()).get(COOKIE)?.value);
  return uid ? findUser(uid) : null;
}

export async function requireUser(role?: User["role"]): Promise<User> {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (role && user.role !== role) redirect(user.role === "analyst" ? "/console" : "/chat");
  return user;
}

export async function startSession(userId: string, remember: boolean) {
  (await cookies()).set(COOKIE, encodeSession(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    ...(remember ? { maxAge: TTL_MS / 1000 } : {}),
  });
}

export async function endSession() {
  (await cookies()).delete(COOKIE);
}

/** Para route handlers: devolve o usuário ou uma resposta 401/403 pronta. */
export async function apiUser(role?: User["role"]): Promise<User | Response> {
  const user = await currentUser();
  if (!user) return Response.json({ error: "Sessão expirada. Entre novamente." }, { status: 401 });
  if (role && user.role !== role) return Response.json({ error: "Acesso negado." }, { status: 403 });
  return user;
}
