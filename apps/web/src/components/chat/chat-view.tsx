"use client";

import { Check, CircleAlert, Headset, LoaderCircle, RotateCcw, SendHorizontal } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { ChatStreamEvent, ConversationSnapshot, Message, MessagePart, User } from "@/lib/types";

import { EmployeeShell } from "../employee-shell";
import { Pill, TypingDots } from "../ui";
import { ArticleChips, DraftCard, Options, TicketCard, TicketSelector } from "./cards";
import { DecisionPanel } from "./decision-panel";
import { mergeSnapshot, postJson, readSse, useLiveConversation } from "./live";

const SUGGESTIONS = ["Minha VPN não conecta", "Qual o status do meu chamado?", "Preciso de acesso a uma pasta", "Qual o horário do service desk?"];

interface Pending {
  text: string;
  steps: string[];
}

export function ChatView({ user, initial }: { user: User; initial: ConversationSnapshot }) {
  const [snap, setSnap] = useState(initial);
  const [pending, setPending] = useState<Pending | null>(null);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { conversation, messages, drafts } = snap;
  const lastId = messages.at(-1)?.id ?? 0;
  const agentActive = conversation.status === "agent";
  const limitReached = conversation.userMessageCount >= conversation.messageLimit;

  useLiveConversation(conversation.id, lastId, (update) => {
    setSnap((s) => mergeSnapshot(s, update));
    // A resposta do agent chegou pelo canal ao vivo antes do fim do streaming.
    if (update.messages?.some((m) => m.role === "assistant")) setPending(null);
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, pending?.text, pending?.steps.length]);

  // Última mensagem do agent: só ela tem opções, seletor e rascunho clicáveis.
  const lastAgentIdx = messages.findLastIndex((m) => m.role === "assistant");
  const interactiveId =
    agentActive && !pending && lastAgentIdx >= 0 && !messages.slice(lastAgentIdx + 1).some((m) => m.role === "user")
      ? messages[lastAgentIdx]!.id
      : null;
  const pendingDraft = useMemo(() => Object.values(drafts).find((d) => d.status === "pending") ?? null, [drafts]);

  const send = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || pending) return;
      setError(null);
      setInput("");
      setPending({ text: "", steps: [] });
      try {
        const res = await fetch("/api/conversations/active/messages", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text }),
        });
        if (!res.ok || !res.body) {
          const data = (await res.json().catch(() => ({}))) as { message?: string };
          throw new Error(data.message ?? "Não foi possível enviar.");
        }
        await readSse<ChatStreamEvent>(res, (e) => {
          switch (e.type) {
            case "user":
              setSnap((s) => mergeSnapshot(s, { messages: [e.message] }));
              break;
            case "steps":
              setPending((p) => p && { ...p, steps: e.steps });
              break;
            case "text":
              setPending((p) => p && { ...p, text: p.text + e.delta });
              break;
            case "text-reset":
              setPending((p) => p && { ...p, text: "" });
              break;
            case "done":
              setSnap((s) => mergeSnapshot(s, e.snapshot));
              setPending(null);
              break;
            case "error":
              setError(e.error);
              setInput(text);
              setPending(null);
              break;
          }
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Não foi possível enviar.");
        setInput(text);
      } finally {
        setPending(null);
      }
    },
    [pending],
  );

  const draftAction = async (id: string, action: "confirm" | "cancel") => {
    setError(null);
    try {
      setSnap(mergeSnapshot(snap, await postJson<ConversationSnapshot>(`/api/drafts/${id}/${action}`)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Algo deu errado.");
    }
  };

  const editDraft = () => {
    setInput("Quero ajustar o rascunho: ");
    inputRef.current?.focus();
  };

  const newConversation = async () => {
    try {
      setSnap(await postJson<ConversationSnapshot>("/api/conversations"));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Algo deu errado.");
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && pendingDraft && interactiveId) {
      e.preventDefault();
      void draftAction(pendingDraft.id, "confirm");
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send(input);
      return;
    }
    // Atalhos 1–4 para as opções rápidas, com o campo vazio.
    if (!input && /^[1-4]$/.test(e.key) && interactiveId) {
      const options = messages.find((m) => m.id === interactiveId)?.parts.find((p) => p.kind === "options");
      const choice = options?.kind === "options" ? options.options[Number(e.key) - 1] : undefined;
      if (choice) {
        e.preventDefault();
        void send(choice);
      }
    }
  };

  const statusPill =
    conversation.status === "agent" ? (
      <Pill tone="success">Assistente online</Pill>
    ) : conversation.status === "waiting_human" ? (
      <Pill tone="warning">Aguardando atendente</Pill>
    ) : (
      <Pill tone="primary">{conversation.assignedAnalyst?.name ?? "Analista"} atendendo</Pill>
    );

  return (
    <EmployeeShell user={user} active="chat" aside={statusPill}>
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto flex max-w-[880px] flex-col gap-5 px-4 pt-7 pb-1 sm:px-8">
            {messages.length === 0 && !pending && <Welcome name={user.name.split(" ")[0]!} onPick={send} />}
            {messages.map((m) => (
              <Message
                key={m.id}
                message={m}
                interactive={m.id === interactiveId}
                drafts={drafts}
                onPick={send}
                onDraft={draftAction}
                onEditDraft={editDraft}
              />
            ))}
            {pending && <PendingReply pending={pending} />}
            <div ref={bottomRef} />
          </div>
        </div>

        <div className="mx-auto w-full max-w-[880px] px-4 pt-2.5 pb-[18px] sm:px-8">
          {!agentActive && (
            <p className="mb-2 flex items-center gap-2 rounded-lg bg-warning-soft px-3 py-2 text-[13px] text-warning-text">
              <Headset size={14} />
              {conversation.status === "human"
                ? `${conversation.assignedAnalyst?.name} está com você. O assistente está pausado.`
                : `Um analista do ${conversation.handoff?.group ?? "suporte"} vai continuar por aqui. O assistente está pausado.`}
            </p>
          )}
          {error && (
            <p role="alert" className="mb-2 flex items-center gap-2 rounded-lg bg-danger-soft px-3 py-2 text-[13px] text-danger-text">
              <CircleAlert size={14} />
              {error}
            </p>
          )}
          {limitReached ? (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-rule bg-desk px-4 py-3 text-[13.5px]">
              <span className="text-ink-2">Você chegou ao limite de {conversation.messageLimit} mensagens nesta sessão.</span>
              <button onClick={newConversation} className="flex items-center gap-1.5 rounded-lg bg-cta px-3 py-2 font-semibold text-white">
                <RotateCcw size={14} /> Nova conversa
              </button>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void send(input);
              }}
              className="flex min-h-12 items-end gap-2 rounded-xl border border-ink/12 bg-paper py-1.5 pr-1.5 pl-4 focus-within:border-cta"
            >
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                rows={1}
                maxLength={2000}
                placeholder="Escreva para o Nexo…"
                aria-label="Mensagem"
                className="max-h-40 flex-1 resize-none self-center bg-transparent py-1.5 text-[14.5px] outline-none placeholder:text-ink-3 [field-sizing:content]"
              />
              <button
                type="submit"
                disabled={!input.trim() || pending !== null}
                className="flex h-9 items-center gap-1.5 rounded-md bg-cta px-3 text-[13.5px] font-semibold text-white hover:bg-cta-hover disabled:opacity-50"
              >
                {pending ? <LoaderCircle size={14} className="animate-spin" /> : <SendHorizontal size={14} />}
                Enviar
              </button>
            </form>
          )}
          <div className="flex items-center justify-between pt-1.5 text-[12.5px] text-ink-3">
            <span>
              {conversation.userMessageCount}/{conversation.messageLimit} mensagens nesta sessão
            </span>
            {agentActive && messages.length > 0 && !limitReached && (
              <button onClick={newConversation} className="hover:text-ink-2">
                Nova conversa
              </button>
            )}
          </div>
        </div>
      </div>
    </EmployeeShell>
  );
}

function Welcome({ name, onPick }: { name: string; onPick: (t: string) => void }) {
  return (
    <div className="flex flex-col gap-3 pt-10">
      <p className="font-display text-[32px] leading-tight">Olá, {name}. Em que posso ajudar?</p>
      <p className="max-w-[560px] text-[14.5px] text-ink-3">
        Descreva o problema com suas palavras. Eu consulto seus chamados, busco na central de ajuda e chamo um analista quando precisar.
      </p>
      <div className="flex flex-wrap gap-1.5 pt-2">
        {SUGGESTIONS.map((s) => (
          <button key={s} onClick={() => onPick(s)} className="rounded-lg border border-rule px-3 py-[7px] text-[13.5px] font-medium hover:border-primary hover:bg-primary-soft hover:text-primary-text">
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

function StatusLine({ steps, busy }: { steps: string[]; busy?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px]">
      <span className="font-semibold">Nexo Assist</span>
      {steps.map((s) => (
        <span key={s} className="flex items-center gap-[5px] text-ink-3">
          <Check size={12} />
          {s}
        </span>
      ))}
      {busy && <TypingDots />}
    </div>
  );
}

function PendingReply({ pending }: { pending: Pending }) {
  return (
    <div className="flex flex-col gap-1.5" aria-live="polite">
      <StatusLine steps={pending.steps} busy />
      {pending.text && (
        <div className="w-fit max-w-[600px] rounded-[4px_12px_12px_12px] border border-rule bg-paper px-4 py-3 text-[14.5px] whitespace-pre-wrap">
          {pending.text}
        </div>
      )}
    </div>
  );
}

function Message({
  message: m,
  interactive,
  drafts,
  onPick,
  onDraft,
  onEditDraft,
}: {
  message: Message;
  interactive: boolean;
  drafts: ConversationSnapshot["drafts"];
  onPick: (text: string) => void;
  onDraft: (id: string, action: "confirm" | "cancel") => Promise<void>;
  onEditDraft: () => void;
}) {
  if (m.role === "user") {
    return (
      <div className="flex justify-end">
        <p className="max-w-[520px] rounded-[12px_12px_4px_12px] bg-ink px-4 py-[11px] text-[14.5px] whitespace-pre-wrap text-white">{m.content}</p>
      </div>
    );
  }
  if (m.role === "system") {
    return (
      <div className="flex items-center gap-3 py-1 text-[12px] font-medium text-ink-3">
        <span className="h-px flex-1 bg-ink/8" />
        {m.content}
        <span className="h-px flex-1 bg-ink/8" />
      </div>
    );
  }
  if (m.role === "analyst") {
    return (
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5 text-[12.5px]">
          <span className="font-semibold">{m.author?.name}</span>
          <span className="rounded-md bg-success-soft px-1.5 py-px text-[11px] font-semibold text-success-text">Analista</span>
        </div>
        <p className="w-fit max-w-[600px] rounded-[4px_12px_12px_12px] bg-human-bubble px-4 py-3 text-[14.5px] whitespace-pre-wrap">{m.content}</p>
      </div>
    );
  }

  const options = m.parts.find((p): p is Extract<MessagePart, { kind: "options" }> => p.kind === "options");
  const others = m.parts.filter((p) => p.kind !== "options");
  return (
    <div className="flex flex-col gap-1.5">
      <StatusLine steps={m.steps} />
      {(m.content || options) && (
        <div className="flex w-fit max-w-[600px] flex-col gap-3 rounded-[4px_12px_12px_12px] border border-rule bg-paper px-4 py-3">
          {m.content && <p className="text-[14.5px] whitespace-pre-wrap">{m.content}</p>}
          {options && <Options part={options} interactive={interactive} onPick={onPick} />}
        </div>
      )}
      {others.map((p, i) => {
        switch (p.kind) {
          case "ticket":
            return <TicketCard key={i} ticket={p.ticket} />;
          case "ticket_selector":
            return <TicketSelector key={i} part={p} interactive={interactive} onPick={onPick} />;
          case "articles":
            return <ArticleChips key={i} part={p} />;
          case "draft": {
            const d = drafts[p.draftId];
            return d ? (
              <DraftCard
                key={i}
                draft={d}
                interactive={interactive}
                onConfirm={() => onDraft(d.id, "confirm")}
                onCancel={() => onDraft(d.id, "cancel")}
                onEdit={onEditDraft}
              />
            ) : null;
          }
        }
      })}
      {m.trace && <DecisionPanel trace={m.trace} />}
    </div>
  );
}
