import { ChevronRight, MessageSquare } from "lucide-react";
import Link from "next/link";
import type { User } from "@/lib/types";
import { staffNav } from "./staff-shell";
import { NexoMark } from "./nexo-mark";
import { LogoutButton, ProfileShortcut, SidebarAccount } from "./sidebar-account";
import { cx } from "./ui";

export function EmployeeShell({
  user,
  active,
  aside,
  children,
}: {
  user: User;
  active: "chat" | "perfil";
  /** Conteúdo à direita do breadcrumb (ex.: status do assistente). */
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  const nav = [
    { href: "/chat", key: "chat", label: "Atendimento", Icon: MessageSquare },
    // Telas extras liberadas por permissão (ex.: relatórios concedidos a um funcionário).
    ...staffNav(user),
  ];

  return (
    <div className="flex h-dvh bg-paper">
      <aside className="hidden w-[232px] shrink-0 flex-col border-r border-rule px-3.5 pt-5 pb-3.5 md:flex">
        <div className="flex items-center gap-2.5 px-2">
          <NexoMark />
          <span className="text-base font-bold">Nexo Assist</span>
        </div>
        <nav className="mt-[22px] flex flex-col gap-0.5">
          {nav.map(({ href, key, label, Icon }) => (
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
        <SidebarAccount user={user} active={active === "perfil"} />
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center gap-4 border-b border-rule px-4 sm:px-8">
          <div className="flex flex-1 items-center gap-2 text-[13.5px]">
            <span className="hidden text-ink-3 sm:inline">Service desk de TI</span>
            <ChevronRight size={14} className="hidden text-ink-3 sm:inline" />
            <span className="font-semibold">{active === "chat" ? "Atendimento" : "Meu perfil"}</span>
          </div>
          {aside}
          <div className="flex items-center gap-1 md:hidden">
            <ProfileShortcut user={user} />
            <LogoutButton compact />
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}
