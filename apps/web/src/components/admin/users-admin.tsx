"use client";

import { CircleAlert, Headset, LoaderCircle, LogOut, Pencil, Plus, Search, UserRoundCheck, UserRoundX, Users, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { logout } from "@/app/login/actions";
import { formatDate } from "@/lib/format";
import { ROLE_LABEL, type SupportTeam, type User, type UserRole } from "@/lib/types";
import { postJson } from "../chat/live";
import { NexoMark } from "../nexo-mark";
import { Avatar, avatarColors, cx, Pill } from "../ui";

type RoleFilter = "all" | UserRole;

interface FormState {
  id?: string;
  name: string;
  email: string;
  role: UserRole;
  department: string;
  team: SupportTeam | "";
  password: string;
}

const EMPTY: FormState = { name: "", email: "", role: "employee", department: "", team: "", password: "" };

async function sendJson<T>(url: string, method: "POST" | "PATCH", body: unknown): Promise<T> {
  if (method === "POST") return postJson<T>(url, body);
  const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = (await res.json().catch(() => ({}))) as T & { message?: string; issues?: { path: string; message: string }[] };
  if (!res.ok) throw new Error(data.issues?.[0] ? `${data.issues[0].path}: ${data.issues[0].message}` : (data.message ?? "Algo deu errado."));
  return data;
}

/** Cadastro de funcionários, analistas e admins (só admin). */
export function UsersAdmin({ admin, initialUsers }: { admin: User; initialUsers: User[] }) {
  const [users, setUsers] = useState(initialUsers);
  const [filter, setFilter] = useState<RoleFilter>("all");
  const [query, setQuery] = useState("");
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((u) => (filter === "all" || u.role === filter) && (!q || u.name.toLowerCase().includes(q) || u.email.includes(q)));
  }, [users, filter, query]);

  const counts = useMemo(() => {
    const c: Record<RoleFilter, number> = { all: users.length, admin: 0, analyst: 0, employee: 0 };
    for (const u of users) c[u.role]++;
    return c;
  }, [users]);

  const upsert = (user: User) => setUsers((list) => [...list.filter((u) => u.id !== user.id), user].sort((a, b) => a.name.localeCompare(b.name)));

  const save = async () => {
    if (!form) return;
    setSaving(true);
    setError(null);
    try {
      const team = form.role === "analyst" ? form.team || null : null;
      const user = form.id
        ? await sendJson<User>(`/api/users/${form.id}`, "PATCH", {
            name: form.name,
            role: form.role,
            department: form.department,
            team,
            ...(form.password ? { password: form.password } : {}),
          })
        : await sendJson<User>("/api/users", "POST", { ...form, team });
      upsert(user);
      setForm(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Algo deu errado.");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (user: User) => {
    setError(null);
    try {
      upsert(await sendJson<User>(`/api/users/${user.id}`, "PATCH", { active: !user.active }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Algo deu errado.");
    }
  };

  const filters: { key: RoleFilter; label: string }[] = [
    { key: "all", label: "Todos" },
    { key: "employee", label: "Funcionários" },
    { key: "analyst", label: "Analistas" },
    { key: "admin", label: "Admins" },
  ];

  return (
    <div className="flex h-dvh bg-paper">
      <aside className="hidden w-[232px] shrink-0 flex-col border-r border-rule px-3.5 pt-5 pb-3.5 md:flex">
        <div className="flex items-center gap-2.5 px-2">
          <NexoMark />
          <span className="text-base font-bold">Nexo Assist</span>
        </div>
        <nav className="mt-[22px] flex flex-col gap-0.5">
          <span className="flex h-9 items-center gap-2.5 rounded-lg bg-primary-soft px-2.5 text-[13.5px] font-semibold text-primary-text">
            <Users size={16} /> Usuários
          </span>
          <Link href="/console" className="flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[13.5px] font-medium text-ink-2 hover:bg-desk">
            <Headset size={16} className="text-ink-3" /> Conversas
          </Link>
        </nav>
        <div className="flex-1" />
        <div className="flex items-center gap-2.5 border-t border-rule px-2 pt-3.5 pb-1">
          <Avatar initials={admin.initials} bg="var(--color-primary-soft)" fg="var(--color-primary-text)" />
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-[13.5px] font-semibold">{admin.name}</span>
            <span className="truncate text-[11.5px] text-ink-3">{admin.email}</span>
          </span>
        </div>
        <form action={logout}>
          <button className="flex h-[34px] w-full items-center gap-2.5 rounded-lg px-2.5 text-[13.5px] font-medium text-ink-2 hover:bg-desk">
            <LogOut size={16} className="text-ink-3" /> Sair
          </button>
        </form>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        <header className="flex flex-wrap items-center gap-3 border-b border-rule px-4 py-4 sm:px-8">
          <div className="flex flex-1 flex-col gap-0.5">
            <h1 className="text-xl font-bold">Usuários</h1>
            <p className="text-[13.5px] text-ink-3">Funcionários abrem chamados; analistas atendem no console; admins gerenciam acessos.</p>
          </div>
          <button
            onClick={() => {
              setError(null);
              setForm(EMPTY);
            }}
            className="flex h-9 items-center gap-1.5 rounded-lg bg-cta px-3.5 text-[13.5px] font-semibold text-white hover:bg-cta-hover"
          >
            <Plus size={15} /> Novo usuário
          </button>
        </header>

        <div className="flex flex-col gap-4 px-4 py-5 sm:px-8">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex gap-1">
              {filters.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={cx(
                    "flex items-center gap-1.5 rounded-full px-[10px] py-1.5 text-[12.5px] font-medium",
                    filter === f.key ? "bg-primary-soft text-primary-text" : "bg-desk text-ink-2 hover:bg-rule",
                  )}
                >
                  {f.label} <span className="font-semibold">{counts[f.key]}</span>
                </button>
              ))}
            </div>
            <label className="flex h-9 w-full max-w-xs items-center gap-2 rounded-full bg-desk px-3">
              <Search size={15} className="text-ink-3" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nome ou e-mail" className="flex-1 bg-transparent text-[13.5px] outline-none" />
            </label>
          </div>

          {error && !form && (
            <p role="alert" className="flex items-center gap-2 rounded-lg bg-danger-soft px-3 py-2 text-[13px] text-danger-text">
              <CircleAlert size={14} /> {error}
            </p>
          )}

          <div className="overflow-x-auto rounded-2xl border border-ink/9">
            <table className="w-full min-w-[720px] text-left text-[13.5px]">
              <thead className="bg-desk text-[12.5px] text-ink-3">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Usuário</th>
                  <th className="px-4 py-2.5 font-medium">Perfil</th>
                  <th className="px-4 py-2.5 font-medium">Área / fila</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">Desde</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {visible.map((u) => (
                  <tr key={u.id} className={cx("border-t border-rule", !u.active && "text-ink-3")}>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-3">
                        <Avatar initials={u.initials} {...avatarColors(u.name)} size={34} />
                        <span className="flex flex-col">
                          <span className="font-medium text-ink">{u.name}</span>
                          <span className="text-[12.5px] text-ink-3">{u.email}</span>
                        </span>
                      </span>
                    </td>
                    <td className="px-4 py-3">{ROLE_LABEL[u.role]}</td>
                    <td className="px-4 py-3">{u.role === "analyst" ? `${u.department} · ${u.team}` : u.department}</td>
                    <td className="px-4 py-3">{u.active ? <Pill tone="success">Ativo</Pill> : <Pill tone="neutral">Inativo</Pill>}</td>
                    <td className="px-4 py-3 text-ink-3">{formatDate(u.createdAt)}</td>
                    <td className="px-4 py-3">
                      <span className="flex justify-end gap-1">
                        <button
                          title="Editar"
                          onClick={() => {
                            setError(null);
                            setForm({ id: u.id, name: u.name, email: u.email, role: u.role, department: u.department, team: u.team ?? "", password: "" });
                          }}
                          className="grid size-8 place-items-center rounded-lg text-ink-2 hover:bg-desk"
                        >
                          <Pencil size={15} />
                        </button>
                        {u.id !== admin.id && (
                          <button
                            title={u.active ? "Desativar" : "Reativar"}
                            onClick={() => toggleActive(u)}
                            className={cx("grid size-8 place-items-center rounded-lg hover:bg-desk", u.active ? "text-danger-text" : "text-success-text")}
                          >
                            {u.active ? <UserRoundX size={15} /> : <UserRoundCheck size={15} />}
                          </button>
                        )}
                      </span>
                    </td>
                  </tr>
                ))}
                {visible.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-ink-3">
                      Nenhum usuário encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {form && (
        <div className="fixed inset-0 z-10 flex justify-end bg-ink/30" onClick={() => setForm(null)}>
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
            className="flex h-full w-full max-w-md flex-col gap-4 overflow-y-auto bg-paper p-6 shadow-xl"
          >
            <div className="flex items-center">
              <h2 className="flex-1 text-lg font-bold">{form.id ? "Editar usuário" : "Novo usuário"}</h2>
              <button type="button" onClick={() => setForm(null)} aria-label="Fechar" className="grid size-8 place-items-center rounded-lg hover:bg-desk">
                <X size={16} />
              </button>
            </div>

            <Field label="Nome completo">
              <input required minLength={3} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} />
            </Field>
            <Field label="E-mail corporativo">
              <input
                required
                type="email"
                disabled={Boolean(form.id)}
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="nome.sobrenome@nexo.com.br"
                className={cx(inputClass, form.id && "bg-desk text-ink-3")}
              />
            </Field>
            <Field label="Perfil">
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })} className={inputClass} disabled={form.id === admin.id}>
                <option value="employee">Funcionário</option>
                <option value="analyst">Analista</option>
                <option value="admin">Admin</option>
              </select>
            </Field>
            <Field label="Área">
              <input required minLength={2} value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} placeholder="Financeiro, Compras, TI…" className={inputClass} />
            </Field>
            {form.role === "analyst" && (
              <Field label="Fila de atendimento">
                <select required value={form.team} onChange={(e) => setForm({ ...form, team: e.target.value as SupportTeam })} className={inputClass}>
                  <option value="">Selecione</option>
                  <option value="Suporte N1">Suporte N1</option>
                  <option value="Suporte N2">Suporte N2</option>
                </select>
              </Field>
            )}
            <Field label={form.id ? "Nova senha (deixe em branco para manter)" : "Senha inicial"}>
              <input
                type="password"
                autoComplete="new-password"
                required={!form.id}
                minLength={8}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className={inputClass}
              />
            </Field>

            {error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-[13px] text-danger-text">{error}</p>}

            <div className="mt-auto flex gap-2 pt-2">
              <button disabled={saving} className="flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-cta text-[14px] font-semibold text-white hover:bg-cta-hover disabled:opacity-70">
                {saving && <LoaderCircle size={15} className="animate-spin" />}
                {form.id ? "Salvar alterações" : "Cadastrar"}
              </button>
              <button type="button" onClick={() => setForm(null)} className="h-10 rounded-lg border border-ink/12 px-4 text-[14px] font-medium hover:bg-desk">
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

const inputClass = "h-10 w-full rounded-lg border border-ink/12 bg-paper px-3 text-[14px] outline-none focus:border-cta";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-[13px] font-medium">
      {label}
      {children}
    </label>
  );
}
