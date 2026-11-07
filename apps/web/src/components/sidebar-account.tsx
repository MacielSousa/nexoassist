import { ChevronRight, Power } from "lucide-react";
import Link from "next/link";
import { logout } from "@/app/login/actions";
import type { User } from "@/lib/types";
import { Avatar, cx } from "./ui";

/** Rodapé da barra lateral: o cartão do usuário leva ao perfil; abaixo, sair. */
export function SidebarAccount({ user, active }: { user: User; active: boolean }) {
  return (
    <>
      <Link
        href="/perfil"
        title="Meu perfil"
        aria-current={active ? "page" : undefined}
        className={cx(
          "group mt-2 flex items-center gap-2.5 rounded-lg border-t border-rule px-2 pt-3.5 pb-2 hover:bg-desk",
          active && "bg-primary-soft hover:bg-primary-soft",
        )}
      >
        <Avatar initials={user.initials} bg="var(--color-primary-soft)" fg="var(--color-primary-text)" src={user.avatarUrl} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className={cx("truncate text-[13.5px] font-semibold", active && "text-primary-text")}>{user.name}</span>
          <span className="truncate text-[11.5px] text-ink-3">{user.email}</span>
        </span>
        <ChevronRight size={15} className="shrink-0 text-ink-3 opacity-0 transition-opacity group-hover:opacity-100" />
      </Link>
      <LogoutButton />
    </>
  );
}

export function LogoutButton({ compact = false }: { compact?: boolean }) {
  return (
    <form action={logout}>
      {compact ? (
        <button aria-label="Sair" title="Sair" className="grid size-9 place-items-center rounded-full text-ink-2 hover:bg-desk">
          <Power size={16} />
        </button>
      ) : (
        <button className="flex h-[34px] w-full items-center gap-2.5 rounded-lg px-2.5 text-[13.5px] font-medium text-ink-2 hover:bg-danger-soft hover:text-danger-text">
          <Power size={15} className="text-current opacity-70" /> Sair
        </button>
      )}
    </form>
  );
}

/** Atalho para o perfil em telas pequenas (sem barra lateral). */
export function ProfileShortcut({ user, asSpan = false }: { user: User; /** Só a foto, quando já está dentro de um link. */ asSpan?: boolean }) {
  const avatar = <Avatar initials={user.initials} bg="var(--color-primary-soft)" fg="var(--color-primary-text)" src={user.avatarUrl} size={asSpan ? 22 : 30} />;
  if (asSpan) return avatar;
  return (
    <Link href="/perfil" aria-label="Meu perfil" title="Meu perfil" className="rounded-full">
      {avatar}
    </Link>
  );
}
