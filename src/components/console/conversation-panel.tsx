"use client";

import { ArrowRightLeft, ArrowUp, Bot, CircleAlert, CircleCheckBig, Hand, Headset, LoaderCircle, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { MessagePart } from "@/agent/types";
import { formatTime, formatWhen } from "@/domain";
import type { User } from "@/server/auth";
import type { ConversationSnapshot, MessageDTO } from "@/server/types";
import { DecisionPanel } from "../chat/decision-panel";
import { mergeSnapshot, postJson, useLiveConversation } from "../chat/live";
import { Avatar, cx, Pill } from "../ui";
import { TicketHistory } from "./ticket-history";

type Action = { action: "take" } | { action: "return" } | { action: "close" } | { action: "message"; text: string };

export function ConversationPanel({ conversationId, analyst, onChange }: { conversationId: number; analyst: User; onChange: () => void }) {
  const [snap, setSnap] = useState<ConversationSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/console/conversations/${conversationId}`, { cache: "no-store" })
      .then(async (r) => (r.ok ? setSnap((await r.json()) as ConversationSnapshot) : setError("Não foi possível abrir a conversa.")))
      .catch(() => setError("Não foi possível abrir a conversa."));
  }, [conversationId]);

  useLiveConversation(snap ? conversationId : null, snap?.messages.at(-1)?.id ?? 0, (update) => {
    setSnap((s) => (s ? mergeSnapshot(s, update) : s));
    onChange();
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [snap?.messages.length]);

  if (!snap) {
    return (
      <div className="grid flex-1 place-items-center bg-console text-ink-3">
        {error ?? <LoaderCircle className="animate-spin" size={20} />}
      </div>
    );
  }

  const { conversation: c, messages } = snap;
  const mine = c.status === "human" && c.assignedAnalyst?.id === analyst.id;
  const first = c.employee.name.split(" ")[0];

  const act = async (body: Action) => {
    setBusy(body.action);
    setError(null);
    try {
      setSnap(mergeSnapshot(snap, await postJson<ConversationSnapshot>(`/api/console/conversations/${conversationId}`, body)));
      if (body.action === "message") setText("");
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Algo deu errado.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <section className="flex min-w-0 flex-1 flex-col bg-console">
        <header className="flex h-16 shrink-0 items-center gap-3 border-b border-rule bg-paper pr-4 pl-5">
          <Avatar initials={c.employee.initials} bg={c.employee.avatarBg} fg={c.employee.avatarFg} size={40} />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="truncate text-[15.5px] font-semibold">{c.employee.name}</span>
            <span className="truncate text-[12.5px] text-ink-3">
              {[c.status === "closed" ? "conversa encerrada" : "online", c.employee.department, c.handoff?.ticket].filter(Boolean).join(" · ")}
            </span>
          </div>
          {mine ? (
            <>
              <button
                onClick={() => act({ action: "return" })}
                disabled={busy !== null}
                className="flex h-9 items-center gap-1.5 rounded-lg border border-ink/12 pr-3 pl-2.5 text-[13.5px] font-medium text-ink-2 hover:bg-desk"
              >
                <Bot size={14} /> Devolver ao agent
              </button>
              <button
                onClick={() => act({ action: "close" })}
                disabled={busy !== null}
                className="flex h-9 items-center gap-1.5 rounded-lg bg-danger-soft pr-3 pl-2.5 text-[13.5px] font-semibold text-danger-text hover:bg-danger/15"
              >
                <CircleCheckBig size={14} /> Encerrar atendimento
              </button>
            </>
          ) : c.status === "waiting_human" ? (
            <Pill tone="warning">Aguardando atendente</Pill>
          ) : c.status === "agent" ? (
            <Pill tone="success">Agent atendendo</Pill>
          ) : c.status === "human" ? (
            <Pill tone="neutral">Com {c.assignedAnalyst?.name}</Pill>
          ) : (
            <Pill tone="neutral">Encerrada</Pill>
          )}
        </header>

        <div className="flex-1 overflow-y-auto px-4 pt-5 pb-4 lg:px-10">
          {c.handoff && (c.status === "waiting_human" || c.status === "human") && <HandoffSummary snap={snap} />}
          <div className="flex justify-center pb-1">
            <span className="rounded-full bg-white/80 px-2.5 py-1 text-xs font-medium text-ink-3">
              {new Date(c.createdAt).toDateString() === new Date().toDateString() ? "Hoje" : new Date(c.createdAt).toLocaleDateString("pt-BR")}
            </span>
          </div>
          {messages.map((m, i) => (
            <ConsoleMessage key={m.id} m={m} grouped={i > 0 && messages[i - 1]!.role === m.role && m.role === "user"} />
          ))}
          <div ref={bottomRef} />
        </div>

        <div className="flex flex-col gap-2.5 border-t border-rule bg-paper px-5 pt-3 pb-3.5">
          {error && (
            <p role="alert" className="flex items-center gap-2 rounded-lg bg-danger-soft px-3 py-2 text-[13px] text-danger-text">
              <CircleAlert size={14} /> {error}
            </p>
          )}
          {!mine && c.status !== "closed" && (
            <div className="flex items-center gap-3">
              <span className={cx("grid size-9 shrink-0 place-items-center rounded-full", c.status === "waiting_human" ? "bg-warning-soft text-warning-text" : "bg-desk text-ink-2")}>
                {c.status === "waiting_human" ? <Hand size={17} /> : <Bot size={17} />}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-[14.5px] font-semibold">
                  {c.status === "waiting_human"
                    ? `${first} espera um atendente`
                    : c.status === "agent"
                      ? `O agent está atendendo ${first}`
                      : `${c.assignedAnalyst?.name} está atendendo`}
                </span>
                <span className="text-[12.5px] text-ink-3">
                  {c.status === "waiting_human" && c.handoff
                    ? `Agent pausado · ${c.handoff.group} · contato até ${formatWhen(c.handoff.contactBy)}`
                    : c.status === "agent"
                      ? "Você pode assumir se precisar intervir."
                      : "Somente quem assumiu pode responder."}
                </span>
              </div>
              {c.status === "waiting_human" && (
                <button
                  onClick={() => act({ action: "return" })}
                  disabled={busy !== null}
                  className="flex h-9 items-center gap-[7px] rounded-lg border border-ink/12 pr-3.5 pl-3 text-[13.5px] font-medium text-ink-2 hover:bg-desk"
                >
                  <Bot size={15} /> Devolver ao agent
                </button>
              )}
              {c.status !== "human" && (
                <button
                  onClick={() => act({ action: "take" })}
                  disabled={busy !== null}
                  className="flex h-9 items-center gap-[7px] rounded-lg bg-cta pr-4 pl-3.5 text-[13.5px] font-semibold text-white hover:bg-cta-hover"
                >
                  {busy === "take" ? <LoaderCircle size={16} className="animate-spin" /> : <Headset size={16} />}
                  Assumir atendimento
                </button>
              )}
            </div>
          )}
          {mine ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (text.trim()) void act({ action: "message", text });
              }}
              className="flex h-11 items-center gap-3"
            >
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={2000}
                placeholder={`Responder ${first}…`}
                aria-label="Resposta"
                autoFocus
                className="h-11 flex-1 rounded-xl bg-desk px-3.5 text-[14.5px] outline-none focus:ring-2 focus:ring-cta/30"
              />
              <button
                aria-label="Enviar"
                disabled={!text.trim() || busy !== null}
                className="grid size-11 shrink-0 place-items-center rounded-full bg-cta text-white hover:bg-cta-hover disabled:opacity-50"
              >
                <ArrowUp size={18} />
              </button>
            </form>
          ) : c.status === "closed" ? (
            <p className="py-2 text-center text-[13.5px] text-ink-3">Conversa encerrada.</p>
          ) : (
            <div className="flex h-11 items-center rounded-xl bg-desk px-3.5 text-[14.5px] text-ink-3">Assuma o atendimento para responder</div>
          )}
        </div>
      </section>
      <TicketHistory employee={c.employee} focusTicket={c.handoff?.ticket ?? null} refreshKey={`${c.status}|${messages.length}`} />
    </>
  );
}

function HandoffSummary({ snap }: { snap: ConversationSnapshot }) {
  const h = snap.conversation.handoff!;
  return (
    <div className="mb-4 flex flex-col gap-1.5 rounded-xl border border-warning/30 bg-paper px-4 py-3">
      <span className="flex items-center gap-2 text-[12.5px] font-semibold text-warning-text">
        <Sparkles size={14} /> Resumo do agent · {h.reasonLabel}
        {h.confidence !== null && ` · confiança ${Math.round(h.confidence * 100)}%`}
      </span>
      <p className="text-[13.5px] text-ink-2">{h.summary}</p>
    </div>
  );
}

function partSummary(p: MessagePart): string {
  switch (p.kind) {
    case "ticket":
      return `Card: ${p.ticket.number} · ${p.ticket.statusLabel}${p.ticket.overdue ? " · vencido" : ""}`;
    case "draft":
      return `Rascunho ${p.draftId}`;
    case "ticket_selector":
      return `Seletor: ${p.tickets.map((t) => t.number).join(", ")}`;
    case "options":
      return `Opções: ${p.options.join(" | ")}`;
    case "articles":
      return `Artigos: ${p.articles.map((a) => a.title).join("; ")}`;
  }
}

function ConsoleMessage({ m, grouped }: { m: MessageDTO; grouped: boolean }) {
  const time = <span className="text-[11px] text-ink-3">{formatTime(m.createdAt)}</span>;
  if (m.role === "system") {
    return (
      <div className="flex items-center gap-3 pt-[18px] pb-1 text-xs font-medium text-ink-3">
        <span className="h-px flex-1 bg-ink/8" />
        <ArrowRightLeft size={13} />
        {m.content} · {formatTime(m.createdAt)}
        <span className="h-px flex-1 bg-ink/8" />
      </div>
    );
  }
  if (m.role === "user") {
    return (
      <div className={cx("flex", grouped ? "pt-[3px]" : "pt-4")}>
        <p className={cx("flex max-w-[520px] items-end gap-2.5 bg-paper px-3 pt-2 pb-1.5 text-[14.5px]", grouped ? "rounded-xl" : "rounded-[4px_12px_12px_12px]")}>
          <span className="whitespace-pre-wrap">{m.content}</span>
          {time}
        </p>
      </div>
    );
  }
  const isAgent = m.role === "assistant";
  return (
    <div className="flex flex-col items-end gap-1 pt-4">
      <span className="flex items-center gap-1.5 px-1 text-xs font-semibold text-ink-2">
        {isAgent ? "Nexo Assist" : m.author?.name}
        <span className={cx("rounded-md px-1.5 py-px text-[11px]", isAgent ? "bg-primary-soft text-primary-text" : "bg-success-soft text-success-text")}>
          {isAgent ? "IA" : "Analista"}
        </span>
      </span>
      <div className={cx("flex max-w-[460px] flex-col gap-1 rounded-[12px_4px_12px_12px] px-3 pt-2 pb-1.5 text-[14.5px]", isAgent ? "bg-agent-bubble" : "bg-human-bubble")}>
        {m.content && <span className="whitespace-pre-wrap">{m.content}</span>}
        {m.parts.map((p, i) => (
          <span key={i} className="text-[12.5px] text-ink-3">
            {partSummary(p)}
          </span>
        ))}
        <span className="flex justify-end">{time}</span>
      </div>
      {isAgent && m.steps.length > 0 && <span className="px-1 text-[11.5px] text-ink-3">{m.steps.join(" · ")}</span>}
      {isAgent && m.trace && (
        <div className="flex w-full max-w-[460px] justify-end">
          <DecisionPanel trace={m.trace} />
        </div>
      )}
    </div>
  );
}
