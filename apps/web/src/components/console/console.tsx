"use client";

import { LogOut, MessageCircle, Search, Users } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { logout } from "@/app/login/actions";
import { formatDate, formatTime, formatWhen } from "@/lib/format";
import type { ConsoleItem, Conversation as ConversationDTO, User } from "@/lib/types";

import { NexoMark } from "../nexo-mark";
import { Avatar, avatarColors, cx, Dot, Pill } from "../ui";
import { ConversationPanel } from "./conversation-panel";

type Filter = "all" | "waiting" | "agent" | "mine";

const POLL_MS = 3000;

export function Console({ analyst, initialItems }: { analyst: User; initialItems: ConsoleItem[] }) {
  const [items, setItems] = useState(initialItems);
  const [filter, setFilter] = useState<Filter>("waiting");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(
    initialItems.find((i) => i.conversation.status === "waiting_human")?.conversation.id ?? initialItems[0]?.conversation.id ?? null,
  );
  const [listError, setListError] = useState(false);
  // Relógio da lista ("agora", "contato em 25 min"), atualizado a cada poll para o render ser puro.
  const [now, setNow] = useState(() => Date.now());

  const refresh = async () => {
    try {
      const res = await fetch("/api/console/conversations", { cache: "no-store" });
      if (!res.ok) throw new Error();
      setItems((await res.json()) as ConsoleItem[]);
      setNow(Date.now());
      setListError(false);
    } catch {
      setListError(true);
    }
  };

  useEffect(() => {
    const t = setInterval(refresh, POLL_MS);
    return () => clearInterval(t);
  }, []);

  const counts = useMemo(
    () => ({
      all: items.length,
      waiting: items.filter((i) => i.conversation.status === "waiting_human").length,
      agent: items.filter((i) => i.conversation.status === "agent").length,
      mine: items.filter((i) => i.conversation.status === "human" && i.conversation.assignedAnalyst?.id === analyst.id).length,
    }),
    [items, analyst.id],
  );

  const visible = items.filter((i) => {
    const c = i.conversation;
    const match =
      filter === "all" ||
      (filter === "waiting" && c.status === "waiting_human") ||
      (filter === "agent" && c.status === "agent") ||
      (filter === "mine" && c.status === "human" && c.assignedAnalyst?.id === analyst.id);
    const q = query.trim().toLowerCase();
    return match && (!q || [c.employee.name, c.handoff?.ticket ?? "", i.lastMessage?.content ?? ""].some((s) => s.toLowerCase().includes(q)));
  });

  const filters: { key: Filter; label: string }[] = [
    { key: "all", label: "Todas" },
    { key: "waiting", label: "Para você" },
    { key: "agent", label: "Com o agent" },
    { key: "mine", label: "Minhas" },
  ];

  return (
    <div className="flex h-dvh bg-paper">
      <nav className="flex w-16 shrink-0 flex-col items-center gap-1.5 border-r border-rule bg-desk py-4">
        <span className="grid size-10 place-items-center pb-2">
          <NexoMark size={22} />
        </span>
        <span aria-current="page" className="flex flex-col items-center gap-1 text-[10.5px] font-semibold text-ink">
          <span className="relative grid size-10 place-items-center rounded-xl bg-paper">
            <MessageCircle size={19} />
            {counts.waiting > 0 && (
              <span className="absolute -top-1 -right-1 grid h-4 min-w-4 place-items-center rounded-full bg-cta px-[5px] text-[10px] font-bold text-white ring-2 ring-desk">
                {counts.waiting}
              </span>
            )}
          </span>
          Conversas
        </span>
        {analyst.role === "admin" && (
          <Link href="/admin/usuarios" className="group flex flex-col items-center gap-1 pt-1 text-[10.5px] font-medium text-ink-3 hover:text-ink">
            <span className="grid size-10 place-items-center rounded-xl group-hover:bg-paper">
              <Users size={19} />
            </span>
            Usuários
          </Link>
        )}
        <span className="flex-1" />
        <form action={logout}>
          <button title="Sair" className="grid size-9 place-items-center rounded-full text-ink-3 hover:bg-paper">
            <LogOut size={16} />
          </button>
        </form>
        <span title={`${analyst.name} · ${analyst.department}`}>
          <Avatar initials={analyst.initials} bg="var(--color-primary-soft)" fg="var(--color-primary-text)" size={36} online ring="var(--color-desk)" />
        </span>
      </nav>

      <section className="flex w-[380px] shrink-0 flex-col border-r border-rule">
        <div className="flex flex-col gap-3 px-4 pt-4 pb-2.5">
          <div className="flex items-center gap-2">
            <h1 className="flex-1 text-xl font-bold">Conversas</h1>
            <Pill tone="success">Disponível</Pill>
          </div>
          <label className="flex h-9 items-center gap-2.5 rounded-full bg-desk px-3">
            <Search size={15} className="text-ink-3" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Pesquisar conversa ou chamado"
              className="flex-1 bg-transparent text-[13.5px] outline-none placeholder:text-ink-3"
            />
          </label>
          <div className="flex gap-1">
            {filters.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={cx(
                  "flex items-center gap-1.5 rounded-full px-[9px] py-1.5 text-[12.5px] font-medium",
                  filter === f.key ? "bg-primary-soft text-primary-text" : "bg-desk text-ink-2 hover:bg-rule",
                )}
              >
                {f.label}
                {f.key !== "all" && <span className={cx("font-semibold", filter === f.key ? "" : "text-ink-3")}>{counts[f.key]}</span>}
              </button>
            ))}
          </div>
        </div>
        {listError && <p className="mx-4 mb-2 rounded-lg bg-warning-soft px-3 py-1.5 text-[12.5px] text-warning-text">Reconectando…</p>}
        <ul className="flex-1 overflow-y-auto px-2">
          {visible.length === 0 && <li className="px-3 py-8 text-center text-[13.5px] text-ink-3">Nenhuma conversa aqui.</li>}
          {visible.map((item) => (
            <ListItem
              key={item.conversation.id}
              item={item}
              analystId={analyst.id}
              now={now}
              active={item.conversation.id === selected}
              onClick={() => setSelected(item.conversation.id)}
            />
          ))}
        </ul>
      </section>

      {selected !== null ? (
        <ConversationPanel key={selected} conversationId={selected} analyst={analyst} onChange={refresh} />
      ) : (
        <div className="grid flex-1 place-items-center bg-console text-[14px] text-ink-3">Selecione uma conversa.</div>
      )}
    </div>
  );
}

function since(iso: string, now: number) {
  const d = new Date(iso);
  if (d.toDateString() === new Date(now).toDateString()) {
    return now - d.getTime() < 60_000 ? "agora" : formatTime(iso);
  }
  return now - d.getTime() < 2 * 24 * 60 * 60_000 ? "ontem" : formatDate(iso);
}

function conversationTag(
  c: ConversationDTO,
  analystId: string,
  now: number,
): { label: string; tone: "danger" | "warning" | "primary" | "success" | "neutral" } {
  switch (c.status) {
    case "waiting_human":
      if (c.handoff?.reason === "baixa_confianca") {
        return { label: `Agent pediu ajuda · confiança ${Math.round((c.handoff.confidence ?? 0) * 100)}%`, tone: "warning" };
      }
      if (c.handoff?.ticket) return { label: `Transferida · ${c.handoff.ticket}`, tone: "danger" };
      return { label: `Transferida · ${contactIn(c.handoff?.contactBy, now)}`, tone: "danger" };
    case "human":
      return c.assignedAnalyst?.id === analystId
        ? { label: "Você está atendendo", tone: "primary" }
        : { label: `Com ${c.assignedAnalyst?.name}`, tone: "neutral" };
    case "agent":
      return { label: "Agent atendendo", tone: "success" };
    case "closed":
      return { label: c.resolvedBy === "agent" ? "Resolvida pelo agent" : "Encerrada", tone: "neutral" };
  }
}

function contactIn(iso: string | undefined, now: number) {
  if (!iso) return "aguardando";
  const min = Math.round((new Date(iso).getTime() - now) / 60_000);
  if (min <= 0) return "prazo de contato vencido";
  return min < 60 ? `contato em ${min} min` : `contato até ${formatWhen(iso)}`;
}

const TAG_TEXT = { danger: "text-danger-text", warning: "text-warning-text", primary: "text-primary-text", success: "text-ink-3", neutral: "text-ink-3" };
const TAG_DOT = { danger: "bg-danger", warning: "bg-warning", primary: "bg-cta", success: "bg-success", neutral: "bg-ink/30" };

function ListItem({
  item,
  analystId,
  now,
  active,
  onClick,
}: {
  item: ConsoleItem;
  analystId: string;
  now: number;
  active: boolean;
  onClick: () => void;
}) {
  const c = item.conversation;
  const tag = conversationTag(c, analystId, now);
  const online = c.status !== "closed" && now - new Date(c.updatedAt).getTime() < 15 * 60_000;
  const last = item.lastMessage;
  const prefix = last?.role === "assistant" ? "Nexo: " : last?.role === "analyst" ? "Analista: " : "";
  return (
    <li>
      <button onClick={onClick} className={cx("flex w-full gap-3 rounded-xl p-2.5 text-left", active ? "bg-desk" : "hover:bg-desk/60")}>
        <Avatar initials={c.employee.initials} {...avatarColors(c.employee.name)} size={46} online={online} ring={active ? "var(--color-desk)" : "var(--color-paper)"} />
        <span className={cx("flex min-w-0 flex-1 flex-col gap-[3px] pb-2.5", !active && "border-b border-rule")}>
          <span className="flex items-center gap-2">
            <span className={cx("flex-1 truncate text-[15.5px]", item.unread ? "font-semibold" : "font-medium")}>{c.employee.name}</span>
            {last && <span className={cx("text-[12.5px]", item.unread ? "font-semibold text-cta" : "text-ink-3")}>{since(last.createdAt, now)}</span>}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="flex-1 truncate text-[13.5px] text-ink-3">{last ? prefix + last.content : "Sem mensagens"}</span>
            {item.unread > 0 && (
              <span className="grid h-5 min-w-5 place-items-center rounded-full bg-cta px-1.5 text-[11.5px] font-bold text-white">{item.unread}</span>
            )}
          </span>
          <span className={cx("flex items-center gap-[5px] text-[11.5px] font-medium", TAG_TEXT[tag.tone])}>
            <Dot className={TAG_DOT[tag.tone]} />
            {tag.label}
          </span>
        </span>
      </button>
    </li>
  );
}
