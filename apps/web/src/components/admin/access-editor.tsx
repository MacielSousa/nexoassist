"use client";

import { Layers, ShieldAlert, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { can, type Permission, type PermissionInfo, type Role, type SupportTeam, type User } from "@/lib/types";
import { PermissionChecklist, RoleChecklist } from "./permission-checklist";
import { DrawerActions, sendJson, TeamSelect } from "./users-admin";

/**
 * Acesso de um usuário em duas camadas:
 * - macro: as roles (cada uma traz um pacote de permissões);
 * - micro: permissões concedidas direto, para o que nenhuma role cobre.
 * As permissões que já vêm de alguma role aparecem marcadas em cinza com a origem.
 */
export function AccessEditor({
  me,
  user,
  roles,
  catalog,
  onSaved,
  onCancel,
}: {
  me: User;
  user: User;
  roles: Role[];
  catalog: PermissionInfo[];
  onSaved: (user: User) => void;
  onCancel: () => void;
}) {
  const [roleIds, setRoleIds] = useState(user.roles.map((r) => r.id));
  const [direct, setDirect] = useState<Permission[]>(user.directPermissions);
  const [team, setTeam] = useState<SupportTeam | "">(user.team ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSelf = user.id === me.id;
  const superGranter = can(me, "roles.manage");
  const lacks = (p: Permission) => !superGranter && !me.permissions.includes(p);

  /** Permissão → nomes das roles selecionadas que a concedem. */
  const fromRoles = useMemo(() => {
    const map = new Map<Permission, string[]>();
    for (const r of roles.filter((r) => roleIds.includes(r.id))) {
      for (const p of r.permissions) map.set(p, [...(map.get(p) ?? []), r.name]);
    }
    return map;
  }, [roles, roleIds]);

  const effective = new Set<Permission>([...fromRoles.keys(), ...direct]);
  // Diretas que uma role já cobre são redundantes: não são enviadas.
  const directToSave = direct.filter((p) => !fromRoles.has(p));
  const attends = effective.has("console.attend");
  const changed =
    [...roleIds].sort().join() !== user.roles.map((r) => r.id).sort().join() ||
    [...directToSave].sort().join() !== [...user.directPermissions].sort().join() ||
    (attends && (team || null) !== user.team);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      onSaved(await sendJson<User>(`/api/users/${user.id}/access`, "PUT", { roleIds, permissions: directToSave, ...(attends ? { team: team || null } : {}) }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Algo deu errado.");
    } finally {
      setSaving(false);
    }
  };

  if (isSelf) {
    return (
      <p className="flex items-start gap-2 rounded-lg bg-warning-soft px-3 py-2.5 text-[13px] text-warning-text">
        <ShieldAlert size={15} className="mt-0.5 shrink-0" />
        Você não pode alterar o próprio acesso. Peça a outro administrador.
      </p>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
      className="flex flex-1 flex-col gap-5"
    >
      <div className="flex flex-wrap gap-2 text-[12.5px]">
        <Stat label="Roles" value={roleIds.length} />
        <Stat label="Diretas" value={directToSave.length} />
        <Stat label="Permissões efetivas" value={effective.size} strong />
      </div>

      <section className="flex flex-col gap-2">
        <h3 className="flex items-center gap-2 text-[14px] font-semibold">
          <Layers size={15} className="text-primary-text" /> Roles <span className="font-normal text-ink-3">· acesso macro</span>
        </h3>
        <p className="text-[12.5px] text-ink-3">Cada role traz um pacote de permissões. Marque quantas a pessoa precisar.</p>
        <RoleChecklist
          roles={roles}
          selected={roleIds}
          onToggle={(id) => setRoleIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]))}
          disabled={(r) => (r.permissions.some(lacks) ? "tem permissões que você não pode conceder" : null)}
        />
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="flex items-center gap-2 text-[14px] font-semibold">
          <Sparkles size={15} className="text-primary-text" /> Permissões diretas <span className="font-normal text-ink-3">· acesso micro</span>
        </h3>
        <p className="text-[12.5px] text-ink-3">Para o que nenhuma role cobre. As marcadas em cinza já vêm das roles acima.</p>
        <PermissionChecklist
          catalog={catalog}
          selected={direct}
          locked={Object.fromEntries([...fromRoles].map(([p, names]) => [p, `pela role ${names.join(", ")}`]))}
          disabled={(p) => lacks(p) && !user.directPermissions.includes(p)}
          onToggle={(p) => setDirect((list) => (list.includes(p) ? list.filter((x) => x !== p) : [...list, p]))}
        />
      </section>

      {attends && (
        <label className="flex flex-col gap-1.5 text-[13px] font-medium">
          Fila de atendimento
          <TeamSelect value={team} onChange={setTeam} />
          <span className="text-[12px] font-normal text-ink-3">Obrigatória porque o acesso inclui atender no console.</span>
        </label>
      )}

      {error && (
        <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-[13px] text-danger-text">
          {error}
        </p>
      )}
      <DrawerActions saving={saving} disabled={!changed} label="Salvar acesso" onCancel={onCancel} />
    </form>
  );
}

function Stat({ label, value, strong = false }: { label: string; value: number; strong?: boolean }) {
  return (
    <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 ${strong ? "bg-primary-soft text-primary-text" : "bg-desk text-ink-2"}`}>
      {label} <strong>{value}</strong>
    </span>
  );
}
