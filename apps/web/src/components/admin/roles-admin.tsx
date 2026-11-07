"use client";

import { CircleAlert, Lock, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import type { Permission, PermissionInfo, Role, User } from "@/lib/types";
import { postJson } from "../chat/live";
import { StaffShell } from "../staff-shell";
import { Pill } from "../ui";
import { PermissionChecklist } from "./permission-checklist";
import { Drawer, DrawerActions } from "./users-admin";

interface FormState {
  id?: string;
  name: string;
  description: string;
  permissions: Permission[];
}

async function request<T>(url: string, method: "PATCH" | "DELETE", body?: unknown): Promise<T> {
  const res = await fetch(url, { method, headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  if (res.status === 204) return undefined as T;
  const data = (await res.json().catch(() => ({}))) as T & { message?: string; issues?: { path: string; message: string }[] };
  if (!res.ok) throw new Error(data.issues?.[0] ? `${data.issues[0].path}: ${data.issues[0].message}` : (data.message ?? "Algo deu errado."));
  return data;
}

/** Cadastro de roles: cada role é um conjunto de permissões do catálogo. */
export function RolesAdmin({ me, initialRoles, catalog }: { me: User; initialRoles: Role[]; catalog: PermissionInfo[] }) {
  const [roles, setRoles] = useState(initialRoles);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const describe = new Map(catalog.map((p) => [p.key, p.description]));

  const run = async (fn: () => Promise<void>) => {
    setSaving(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Algo deu errado.");
    } finally {
      setSaving(false);
    }
  };

  const upsert = (role: Role) => setRoles((list) => (list.some((r) => r.id === role.id) ? list.map((r) => (r.id === role.id ? { ...r, ...role } : r)) : [...list, { ...role, userCount: 0 }]));

  const save = () =>
    run(async () => {
      if (!form) return;
      const body = { name: form.name, description: form.description, permissions: form.permissions };
      upsert(form.id ? await request<Role>(`/api/roles/${form.id}`, "PATCH", body) : await postJson<Role>("/api/roles", body));
      setForm(null);
    });

  const remove = (role: Role) => {
    if (!confirm(`Excluir a role "${role.name}"?`)) return;
    void run(async () => {
      await request(`/api/roles/${role.id}`, "DELETE");
      setRoles((list) => list.filter((r) => r.id !== role.id));
    });
  };

  return (
    <>
      <StaffShell user={me} active="roles">
        <header className="flex flex-wrap items-center gap-3 border-b border-rule px-4 py-4 sm:px-8">
          <div className="flex flex-1 flex-col gap-0.5">
            <h1 className="text-xl font-bold">Roles e permissões</h1>
            <p className="text-[13.5px] text-ink-3">Uma role agrupa permissões. Para dar algo a mais a uma pessoa, use Usuários → Permissões.</p>
          </div>
          <button
            onClick={() => {
              setError(null);
              setForm({ name: "", description: "", permissions: [] });
            }}
            className="flex h-9 items-center gap-1.5 rounded-lg bg-cta px-3.5 text-[13.5px] font-semibold text-white hover:bg-cta-hover"
          >
            <Plus size={15} /> Nova role
          </button>
        </header>

        <div className="flex flex-col gap-4 px-4 py-5 sm:px-8">
          {error && !form && (
            <p role="alert" className="flex items-center gap-2 rounded-lg bg-danger-soft px-3 py-2 text-[13px] text-danger-text">
              <CircleAlert size={14} /> {error}
            </p>
          )}
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {roles.map((role) => (
              <article key={role.id} className="flex flex-col gap-3 rounded-2xl border border-ink/9 p-4">
                <div className="flex items-start gap-2">
                  <div className="flex flex-1 flex-col gap-0.5">
                    <h2 className="flex items-center gap-2 font-semibold">
                      {role.name}
                      {role.isSystem && (
                        <Pill tone="neutral">
                          <Lock size={11} /> sistema
                        </Pill>
                      )}
                    </h2>
                    <p className="text-[12.5px] text-ink-3">
                      <code>{role.key}</code> · {role.userCount ?? 0} usuário(s)
                    </p>
                  </div>
                  <button
                    title="Editar"
                    onClick={() => {
                      setError(null);
                      setForm({ id: role.id, name: role.name, description: role.description, permissions: role.permissions });
                    }}
                    className="grid size-8 place-items-center rounded-lg text-ink-2 hover:bg-desk"
                  >
                    <Pencil size={15} />
                  </button>
                  {!role.isSystem && (
                    <button
                      title={role.userCount ? "Há usuários nesta role" : "Excluir"}
                      disabled={Boolean(role.userCount)}
                      onClick={() => remove(role)}
                      className="grid size-8 place-items-center rounded-lg text-danger-text hover:bg-desk disabled:opacity-40"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
                {role.description && <p className="text-[13px] text-ink-2">{role.description}</p>}
                <ul className="flex flex-wrap gap-1">
                  {role.permissions.map((p) => (
                    <li key={p} title={describe.get(p)} className="rounded-full bg-desk px-2 py-0.5 text-[11.5px] text-ink-2">
                      {p}
                    </li>
                  ))}
                  {role.permissions.length === 0 && <li className="text-[12.5px] text-ink-3">Sem permissões</li>}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </StaffShell>

      {form && (
        <Drawer title={form.id ? "Editar role" : "Nova role"} onClose={() => setForm(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
            className="flex flex-1 flex-col gap-4"
          >
            <label className="flex flex-col gap-1.5 text-[13px] font-medium">
              Nome
              <input required minLength={2} maxLength={60} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-10 rounded-lg border border-ink/12 bg-paper px-3 text-[14px] outline-none focus:border-cta" />
            </label>
            <label className="flex flex-col gap-1.5 text-[13px] font-medium">
              Descrição
              <textarea maxLength={200} rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="rounded-lg border border-ink/12 bg-paper px-3 py-2 text-[14px] outline-none focus:border-cta" />
            </label>
            <PermissionChecklist
              catalog={catalog}
              selected={form.permissions}
              onToggle={(p) => setForm({ ...form, permissions: form.permissions.includes(p) ? form.permissions.filter((x) => x !== p) : [...form.permissions, p] })}
            />
            {error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-[13px] text-danger-text">{error}</p>}
            <DrawerActions saving={saving} label={form.id ? "Salvar role" : "Criar role"} onCancel={() => setForm(null)} />
          </form>
        </Drawer>
      )}
    </>
  );
}
