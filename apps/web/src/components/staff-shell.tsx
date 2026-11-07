import { BarChart3, Headset, LogOut, UserRound, Users } from "lucide-react";
import Link from "next/link";
import { logout } from "@/app/login/actions";
import type { User } from "@/lib/types";
import { NexoMark } from "./nexo-mark";
import { Avatar, cx } from "./ui";

export type StaffSection = "console" | "reports" | "users" | "profile";

/** Itens do menu da equipe de TI. Usuários só aparece para admin. */
export function staffNav(user: User) {
  return [
    { key: "console" as const, href: "/console", label: "Conversas", Icon: Headset },
    { key: "reports" as const, href: "/relatorios", label: "Relatórios", Icon: BarChart3 },
    ...(user.role === "admin" ? [{ key: "users" as const, href: "/admin/usuarios", label: "Usuários", Icon: Users }] : []),
    { key: "profile" as const, href: "/perfil", label: "Meu perfil", Icon: UserRound },
  ];
}

/** Layout das telas de analistas e admins (relatórios, usuários). */
export function StaffShell({ user, active, children }: { user: User; active: StaffSection; children: React.ReactNode }) {
  return (
    <div className="flex h-dvh bg-paper">
      <aside className="hidden w-[232px] shrink-0 flex-col border-r border-rule px-3.5 pt-5 pb-3.5 md:flex">
        <div className="flex items-center gap-2.5 px-2">
          <NexoMark />
          <span className="text-base font-bold">Nexo Assist</span>
        </div>
        <nav className="mt-[22px] flex flex-col gap-0.5">
          {staffNav(user).map(({ key, href, label, Icon }) => (
            <Link
              key={key}
              href={href}
              aria-current={active === key ? "page" : undefined}
              className={cx(
                "flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[13.5px]",
                active === key ? "bg-primary-soft font-semibold text-primary-text" : "font-medium text-ink-2 hover:bg-desk",
              )}
            >
              <Icon size={16} className={active === key ? "text-primary-text" : "text-ink-3"} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="flex-1" />
        <div className="flex items-center gap-2.5 border-t border-rule px-2 pt-3.5 pb-1">
          <Avatar initials={user.initials} bg="var(--color-primary-soft)" fg="var(--color-primary-text)" src={user.avatarUrl} />
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-[13.5px] font-semibold">{user.name}</span>
            <span className="truncate text-[11.5px] text-ink-3">{user.email}</span>
          </span>
        </div>
        <form action={logout}>
          <button className="flex h-[34px] w-full items-center gap-2.5 rounded-lg px-2.5 text-[13.5px] font-medium text-ink-2 hover:bg-desk">
            <LogOut size={16} className="text-ink-3" /> Sair
          </button>
        </form>
      </aside>

      {/* Menu compacto em telas pequenas */}
      <nav className="fixed inset-x-0 bottom-0 z-10 flex border-t border-rule bg-paper md:hidden">
        {staffNav(user).map(({ key, href, label, Icon }) => (
          <Link key={key} href={href} className={cx("flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px]", active === key ? "text-primary-text" : "text-ink-3")}>
            <Icon size={18} /> {label}
          </Link>
        ))}
      </nav>

      <main className="flex min-w-0 flex-1 flex-col overflow-y-auto pb-14 md:pb-0">{children}</main>
    </div>
  );
}
