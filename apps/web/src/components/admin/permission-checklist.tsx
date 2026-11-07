"use client";

import { Check } from "lucide-react";
import type { Permission, PermissionInfo, Role } from "@/lib/types";
import { cx } from "../ui";

/** Item com caixa de seleção (visual próprio, input nativo acessível por baixo). */
function CheckItem({
  checked,
  disabled,
  locked = false,
  onToggle,
  title,
  children,
}: {
  checked: boolean;
  disabled: boolean;
  /** Marcada por herança: cinza em vez de azul. */
  locked?: boolean;
  onToggle: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <label className={cx("flex items-start gap-2.5 rounded-lg px-2 py-1.5 text-[13.5px]", disabled ? "cursor-default" : "cursor-pointer hover:bg-desk")}>
      <input type="checkbox" aria-label={title} className="peer sr-only" checked={checked} disabled={disabled} onChange={onToggle} />
      <span
        className={cx(
          "mt-0.5 grid size-[18px] shrink-0 place-items-center rounded-md border peer-focus-visible:outline-2 peer-focus-visible:outline-cta",
          checked ? (locked ? "border-ink/25 bg-ink/25" : "border-cta bg-cta") : "border-ink/20 bg-paper",
        )}
      >
        {checked && <Check size={12} strokeWidth={3} className="text-white" />}
      </span>
      <span className="flex min-w-0 flex-col">{children}</span>
    </label>
  );
}

/**
 * Permissões agrupadas por área. Permissões "travadas" aparecem marcadas em cinza com o
 * motivo (ex.: "pela role Analista") e não podem ser desmarcadas aqui.
 */
export function PermissionChecklist({
  catalog,
  selected,
  onToggle,
  locked = {},
  disabled = () => false,
}: {
  catalog: PermissionInfo[];
  selected: Permission[];
  onToggle: (p: Permission) => void;
  /** Permissão → motivo de estar travada (aparece marcada). */
  locked?: Partial<Record<Permission, string>>;
  /** Permissões que quem está editando não pode conceder. */
  disabled?: (p: Permission) => boolean;
}) {
  const groups = [...new Set(catalog.map((p) => p.group))];
  return (
    <div className="flex flex-col gap-4">
      {groups.map((group) => (
        <fieldset key={group} className="flex flex-col gap-1">
          <legend className="pb-1 text-[12px] font-semibold tracking-wide text-ink-3 uppercase">{group}</legend>
          {catalog
            .filter((p) => p.group === group)
            .map((p) => {
              const lockedReason = locked[p.key];
              const blocked = !lockedReason && disabled(p.key);
              return (
                <CheckItem
                  key={p.key}
                  title={p.description}
                  checked={Boolean(lockedReason) || selected.includes(p.key)}
                  locked={Boolean(lockedReason)}
                  disabled={Boolean(lockedReason) || blocked}
                  onToggle={() => onToggle(p.key)}
                >
                  <span className={cx(blocked && "text-ink-3")}>{p.description}</span>
                  <span className="text-[11.5px] text-ink-3">
                    <code>{p.key}</code>
                    {lockedReason && ` · ${lockedReason}`}
                    {blocked && " · você não tem esta permissão para conceder"}
                  </span>
                </CheckItem>
              );
            })}
        </fieldset>
      ))}
    </div>
  );
}

/** Lista de roles com caixas de seleção (um usuário pode ter várias). */
export function RoleChecklist({
  roles,
  selected,
  onToggle,
  disabled = () => null,
}: {
  roles: Role[];
  selected: string[];
  onToggle: (roleId: string) => void;
  /** Motivo de não poder marcar a role (ou null). */
  disabled?: (role: Role) => string | null;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      {roles.map((r) => {
        const checked = selected.includes(r.id);
        const reason = checked ? null : disabled(r);
        return (
          <CheckItem key={r.id} title={r.name} checked={checked} disabled={Boolean(reason)} onToggle={() => onToggle(r.id)}>
            <span className={cx("font-medium", reason && "text-ink-3")}>{r.name}</span>
            <span className="text-[11.5px] text-ink-3">
              {r.description || `${r.permissions.length} permissões`}
              {reason && ` · ${reason}`}
            </span>
          </CheckItem>
        );
      })}
    </div>
  );
}
