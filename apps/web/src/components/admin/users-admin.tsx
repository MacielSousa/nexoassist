"use client";

import { CircleAlert, KeyRound, LoaderCircle, Pencil, Plus, Search, UserRoundCheck, UserRoundX, X } from "lucide-react";
import { useMemo, useState } from "react";
import { formatDate } from "@/lib/format";
import { can, type Permission, type PermissionInfo, type Role, type SupportTeam, type User } from "@/lib/types";
import { postJson } from "../chat/live";
import { AvatarEditor } from "../profile/avatar-editor";
import { StaffShell } from "../staff-shell";
import { Avatar, avatarColors, cx, Pill } from "../ui";
import { PermissionChecklist } from "./permission-checklist";

interface FormState {
  id?: string;
  name: string;
  email: string;
  roleId: string;
  department: string;
  team: SupportTeam | "";
  password: string;
}

async function sendJson<T>(url: string, method: "POST" | "PATCH" | "PUT", body: unknown): Promise<T> {
  if (method === "POST") return postJson<T>(url, body);
  const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = (await res.json().catch(() => ({}))) as T & { message?: string; issues?: { path: string; message: string }[] };
  if (!res.ok) throw new Error(data.issues?.[0] ? `${data.issues[0].path}: ${data.issues[0].message}` : (data.message ?? "Algo deu errado."));
  return data;
}

/**
 * Usuários: cadastro, edição, ativação e permissões extras.
 * Quem tem só users.view vê a lista sem os botões de edição.
 */
export function UsersAdmin({ me, initialUsers, roles, catalog }: { me: User; initialUsers: User[]; roles: Role[]; catalog: PermissionInfo[] }) {
  const canManage = can(me, "users.manage");
  const [users, setUsers] = useState(initialUsers);
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [form, setForm] = useState<FormState | null>(null);
  const [permsFor, setPermsFor] = useState<{ user: User; extras: Permission[] } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rolesById = useMemo(() => new Map(roles.map((r) => [r.id, r])), [roles]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((u) => (roleFilter === "all" || u.role.id === roleFilter) && (!q || u.name.toLowerCase().includes(q) || u.email.includes(q)));
  }, [users, roleFilter, query]);

  const upsert = (user: User) => setUsers((list) => [...list.filter((u) => u.id !== user.id), user].sort((a, b) => a.name.localeCompare(b.name)));
  const selectedRole = form ? rolesById.get(form.roleId) : undefined;
  const needsTeam = Boolean(selectedRole?.permissions.includes("console.attend"));
  // Sem escalada: só dá para conceder o que você mesmo tem (quem gerencia roles concede tudo).
  const cannotGrant = (p: Permission) => !can(me, "roles.manage") && !me.permissions.includes(p);

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

  const saveUser = () =>
    run(async () => {
      if (!form) return;
      const team = needsTeam ? form.team || null : null;
      const user = form.id
        ? await sendJson<User>(`/api/users/${form.id}`, "PATCH", {
            name: form.name,
            roleId: form.roleId,
            department: form.department,
            team,
            ...(form.password ? { password: form.password } : {}),
          })
        : await sendJson<User>("/api/users", "POST", { ...form, team });
      upsert(user);
      setForm(null);
    });

  const savePermissions = () =>
    run(async () => {
      if (!permsFor) return;
      upsert(await sendJson<User>(`/api/users/${permsFor.user.id}/permissions`, "PUT", { permissions: permsFor.extras }));
      setPermsFor(null);
    });

  const toggleActive = (user: User) => run(async () => upsert(await sendJson<User>(`/api/users/${user.id}`, "PATCH", { active: !user.active })));

  return (
    <>
      <StaffShell user={me} active="users">
        <header className="flex flex-wrap items-center gap-3 border-b border-rule px-4 py-4 sm:px-8">
          <div className="flex flex-1 flex-col gap-0.5">
            <h1 className="text-xl font-bold">Usuários</h1>
            <p className="text-[13.5px] text-ink-3">Cada usuário tem uma role e pode receber permissões extras.</p>
          </div>
          {canManage && (
            <button
              onClick={() => {
                setError(null);
                setForm({ name: "", email: "", roleId: roles.find((r) => r.key === "employee")?.id ?? roles[0]!.id, department: "", team: "", password: "" });
              }}
              className="flex h-9 items-center gap-1.5 rounded-lg bg-cta px-3.5 text-[13.5px] font-semibold text-white hover:bg-cta-hover"
            >
              <Plus size={15} /> Novo usuário
            </button>
          )}
        </header>

        <div className="flex flex-col gap-4 px-4 py-5 sm:px-8">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex flex-wrap gap-1">
              {[{ id: "all", name: "Todos" }, ...roles].map((r) => (
                <button
                  key={r.id}
                  onClick={() => setRoleFilter(r.id)}
                  className={cx(
                    "flex items-center gap-1.5 rounded-full px-[10px] py-1.5 text-[12.5px] font-medium",
                    roleFilter === r.id ? "bg-primary-soft text-primary-text" : "bg-desk text-ink-2 hover:bg-rule",
                  )}
                >
                  {r.name} <span className="font-semibold">{r.id === "all" ? users.length : users.filter((u) => u.role.id === r.id).length}</span>
                </button>
              ))}
            </div>
            <label className="flex h-9 w-full max-w-xs items-center gap-2 rounded-full bg-desk px-3">
              <Search size={15} className="text-ink-3" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nome ou e-mail" className="flex-1 bg-transparent text-[13.5px] outline-none" />
            </label>
          </div>

          {error && !form && !permsFor && (
            <p role="alert" className="flex items-center gap-2 rounded-lg bg-danger-soft px-3 py-2 text-[13px] text-danger-text">
              <CircleAlert size={14} /> {error}
            </p>
          )}

          <div className="overflow-x-auto rounded-2xl border border-ink/9">
            <table className="w-full min-w-[760px] text-left text-[13.5px]">
              <thead className="bg-desk text-[12.5px] text-ink-3">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Usuário</th>
                  <th className="px-4 py-2.5 font-medium">Role</th>
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
                        <Avatar initials={u.initials} {...avatarColors(u.name)} src={u.avatarUrl} size={34} />
                        <span className="flex flex-col">
                          <span className="font-medium text-ink">{u.name}</span>
                          <span className="text-[12.5px] text-ink-3">{u.email}</span>
                        </span>
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex flex-col">
                        {u.role.name}
                        {u.extraPermissions.length > 0 && (
                          <span className="text-[12px] text-primary-text">+{u.extraPermissions.length} permissão(ões) extra(s)</span>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3">{u.team ? `${u.department} · ${u.team}` : u.department}</td>
                    <td className="px-4 py-3">{u.active ? <Pill tone="success">Ativo</Pill> : <Pill tone="neutral">Inativo</Pill>}</td>
                    <td className="px-4 py-3 text-ink-3">{formatDate(u.createdAt)}</td>
                    <td className="px-4 py-3">
                      {canManage && (
                        <span className="flex justify-end gap-1">
                          <button
                            title="Editar"
                            onClick={() => {
                              setError(null);
                              setForm({ id: u.id, name: u.name, email: u.email, roleId: u.role.id, department: u.department, team: u.team ?? "", password: "" });
                            }}
                            className="grid size-8 place-items-center rounded-lg text-ink-2 hover:bg-desk"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            title="Permissões"
                            onClick={() => {
                              setError(null);
                              setPermsFor({ user: u, extras: u.extraPermissions });
                            }}
                            className="grid size-8 place-items-center rounded-lg text-ink-2 hover:bg-desk"
                          >
                            <KeyRound size={15} />
                          </button>
                          {u.id !== me.id && (
                            <button
                              title={u.active ? "Desativar" : "Reativar"}
                              onClick={() => toggleActive(u)}
                              className={cx("grid size-8 place-items-center rounded-lg hover:bg-desk", u.active ? "text-danger-text" : "text-success-text")}
                            >
                              {u.active ? <UserRoundX size={15} /> : <UserRoundCheck size={15} />}
                            </button>
                          )}
                        </span>
                      )}
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
      </StaffShell>

      {form && (
        <Drawer title={form.id ? "Editar usuário" : "Novo usuário"} onClose={() => setForm(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void saveUser();
            }}
            className="flex flex-1 flex-col gap-4"
          >
            {form.id && users.find((u) => u.id === form.id) && (
              <AvatarEditor user={users.find((u) => u.id === form.id)!} endpoint={`/api/users/${form.id}/avatar`} onChange={upsert} size={56} />
            )}
            <Field label="Nome completo">
              <input required minLength={3} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} />
            </Field>
            <Field label="E-mail corporativo">
              <input
                required
                type="email"
                disabled={Boolean(form.id)}
                title={form.id ? "Só a própria pessoa troca o e-mail (em Meu perfil, com a senha)." : undefined}
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="nome.sobrenome@nexo.com.br"
                className={cx(inputClass, form.id && "bg-desk text-ink-3")}
              />
            </Field>
            <Field label="Role">
              <select value={form.roleId} onChange={(e) => setForm({ ...form, roleId: e.target.value })} className={inputClass} disabled={form.id === me.id}>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
              {selectedRole && <span className="text-[12px] font-normal text-ink-3">{selectedRole.description || `${selectedRole.permissions.length} permissões`}</span>}
            </Field>
            <Field label="Área">
              <input required minLength={2} value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} placeholder="Financeiro, Compras, TI…" className={inputClass} />
            </Field>
            {needsTeam && (
              <Field label="Fila de atendimento">
                <select required value={form.team} onChange={(e) => setForm({ ...form, team: e.target.value as SupportTeam })} className={inputClass}>
                  <option value="">Selecione</option>
                  <option value="Suporte N1">Suporte N1</option>
                  <option value="Suporte N2">Suporte N2</option>
                </select>
              </Field>
            )}
            <Field label={form.id ? "Nova senha (deixe em branco para manter)" : "Senha inicial"}>
              <input type="password" autoComplete="new-password" required={!form.id} minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className={inputClass} />
            </Field>
            {error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-[13px] text-danger-text">{error}</p>}
            <DrawerActions saving={saving} label={form.id ? "Salvar alterações" : "Cadastrar"} onCancel={() => setForm(null)} />
          </form>
        </Drawer>
      )}

      {permsFor && (
        <Drawer title={`Permissões de ${permsFor.user.name.split(" ")[0]}`} onClose={() => setPermsFor(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void savePermissions();
            }}
            className="flex flex-1 flex-col gap-4"
          >
            <p className="text-[13px] text-ink-3">
              As marcadas em cinza vêm da role <strong className="text-ink-2">{permsFor.user.role.name}</strong>. Marque as extras que este usuário deve ter além delas.
            </p>
            <PermissionChecklist
              catalog={catalog}
              selected={permsFor.extras}
              locked={Object.fromEntries((rolesById.get(permsFor.user.role.id)?.permissions ?? []).map((p) => [p, `pela role ${permsFor.user.role.name}`]))}
              disabled={(p) => cannotGrant(p) && !permsFor.extras.includes(p)}
              onToggle={(p) => setPermsFor({ ...permsFor, extras: permsFor.extras.includes(p) ? permsFor.extras.filter((x) => x !== p) : [...permsFor.extras, p] })}
            />
            {error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-[13px] text-danger-text">{error}</p>}
            <DrawerActions saving={saving} label="Salvar permissões" onCancel={() => setPermsFor(null)} />
          </form>
        </Drawer>
      )}
    </>
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

export function Drawer({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-20 flex justify-end bg-ink/30" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="flex h-full w-full max-w-md flex-col gap-4 overflow-y-auto bg-paper p-6 shadow-xl" role="dialog" aria-label={title}>
        <div className="flex items-center">
          <h2 className="flex-1 text-lg font-bold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Fechar" className="grid size-8 place-items-center rounded-lg hover:bg-desk">
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function DrawerActions({ saving, label, onCancel }: { saving: boolean; label: string; onCancel: () => void }) {
  return (
    <div className="mt-auto flex gap-2 pt-2">
      <button disabled={saving} className="flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-cta text-[14px] font-semibold text-white hover:bg-cta-hover disabled:opacity-70">
        {saving && <LoaderCircle size={15} className="animate-spin" />}
        {label}
      </button>
      <button type="button" onClick={onCancel} className="h-10 rounded-lg border border-ink/12 px-4 text-[14px] font-medium hover:bg-desk">
        Cancelar
      </button>
    </div>
  );
}
