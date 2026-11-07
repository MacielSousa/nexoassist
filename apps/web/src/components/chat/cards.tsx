"use client";

import { LoaderCircle } from "lucide-react";
import { useState } from "react";
import { AFFECTED_LABEL, type Draft, type MessagePart, type TicketCard as TicketCardData } from "@/lib/types";
import { formatDate, formatDateTime, formatRelative, formatWhen } from "@/lib/format";
import { cx, Dot, PRIORITY_DOT, STATUS_DOT } from "../ui";

const deadlineText = (iso: string) => `até ${formatWhen(iso)}`;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <span className="text-[12.5px] text-ink-3">{label}</span>
      <span className="flex flex-wrap items-center gap-1.5 text-[14.5px] font-medium">{children}</span>
    </div>
  );
}

function Eyebrow({ kind, id, state }: { kind: string; id: string; state: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 pb-0.5 text-[12.5px] text-ink-3">
      <span className="font-medium">{kind}</span>
      <Dot className="bg-rule" size={3} />
      <span>{id}</span>
      <span className="flex-1" />
      {state}
    </div>
  );
}

export function TicketCard({ ticket }: { ticket: TicketCardData }) {
  return (
    <div className="w-full max-w-[680px] overflow-hidden rounded-2xl border border-ink/9 bg-paper">
      <div className="flex flex-col gap-1.5 px-[18px] pt-4 pb-3.5">
        <Eyebrow
          kind="Chamado"
          id={ticket.number}
          state={
            <span className={cx("flex items-center gap-1.5 font-medium", ticket.status === "aguardando_analista" ? "text-warning-text" : "text-ink-2")}>
              <Dot className={STATUS_DOT[ticket.status]} />
              {ticket.statusLabel}
            </span>
          }
        />
        <h3 className="text-lg font-semibold">{ticket.title}</h3>
        <p className="text-[13.5px] text-ink-2">{ticket.description}</p>
      </div>
      <div className="px-[18px] pb-4">
        <div className="flex flex-wrap gap-6 border-t border-rule pt-3">
          <Field label="Categoria">{ticket.category}</Field>
          <Field label="Prioridade">
            <Dot className={PRIORITY_DOT[ticket.priority]} />
            {ticket.priority}
          </Field>
          <Field label="Aberto em">{formatDateTime(ticket.createdAt)}</Field>
          <Field label="Última atualização">
            <span className={ticket.overdue ? "text-warning-text" : ""}>{formatRelative(ticket.updatedAt)}</span>
            {ticket.overdue && <span className="text-[13.5px] font-normal text-ink-3">· prazo vencido</span>}
          </Field>
        </div>
      </div>
    </div>
  );
}

const DRAFT_STATE: Record<Draft["status"], { label: string; className: string; dot: string }> = {
  pending: { label: "Aguardando confirmação", className: "text-warning-text", dot: "bg-warning" },
  confirmed: { label: "Confirmado", className: "text-success-text", dot: "bg-success" },
  cancelled: { label: "Cancelado", className: "text-ink-3", dot: "bg-ink/25" },
  superseded: { label: "Substituído", className: "text-ink-3", dot: "bg-ink/25" },
  failed: { label: "Falhou", className: "text-danger-text", dot: "bg-danger" },
};

export function DraftCard({
  draft,
  interactive,
  onConfirm,
  onEdit,
  onCancel,
}: {
  draft: Draft;
  interactive: boolean;
  onConfirm: () => Promise<void>;
  onEdit: () => void;
  onCancel: () => Promise<void>;
}) {
  const [busy, setBusy] = useState<"confirm" | "cancel" | null>(null);
  const state = DRAFT_STATE[draft.status];
  const isUpdate = draft.kind === "update";
  const run = async (which: "confirm" | "cancel", fn: () => Promise<void>) => {
    setBusy(which);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  };
  const mac = typeof navigator !== "undefined" && /Mac/.test(navigator.platform);

  return (
    <div className={cx("w-full max-w-[680px] overflow-hidden rounded-2xl border border-ink/9 bg-paper", draft.status !== "pending" && "opacity-80")}>
      <div className="flex flex-col gap-1.5 px-[18px] pt-4 pb-3.5">
        <Eyebrow
          kind={isUpdate ? (draft.reopen ? "Reabrir chamado" : "Atualizar chamado") : "Novo chamado"}
          id={`Rascunho ${draft.id}`}
          state={
            <span className={cx("flex items-center gap-1.5 font-medium", state.className)}>
              <Dot className={state.dot} />
              {state.label}
              {draft.resultTicket && ` · ${draft.resultTicket}`}
            </span>
          }
        />
        <h3 className="text-lg font-semibold">{isUpdate ? `${draft.ticketNumber} · ${draft.title}` : draft.title}</h3>
        <p className="text-[13.5px] whitespace-pre-wrap text-ink-2">{isUpdate ? draft.comment : draft.description}</p>
      </div>
      <div className="px-[18px] pb-4">
        <div className="flex flex-wrap gap-6 border-t border-rule pt-3">
          <Field label="Categoria">{draft.category}</Field>
          <Field label="Prioridade">
            <Dot className={PRIORITY_DOT[draft.priority]} />
            {draft.priority}
            {!isUpdate && <span className="text-[13.5px] font-normal text-ink-3">· resposta {deadlineText(draft.deadline)}</span>}
          </Field>
          <Field label={isUpdate ? "Tipo" : "Afetados"}>{isUpdate ? draft.type : AFFECTED_LABEL[draft.affected]}</Field>
        </div>
        {!isUpdate && <p className="pt-2.5 text-[12.5px] text-ink-3">Por que {draft.priority.toLowerCase()}: {draft.priorityReason} Prazo: {draft.slaLabel}.</p>}
      </div>
      {interactive && draft.status === "pending" && (
        <div className="flex items-center gap-1.5 border-t border-rule bg-desk py-2 pr-3.5 pl-2">
          <button
            onClick={() => run("confirm", onConfirm)}
            disabled={busy !== null}
            className="flex h-9 items-center gap-2 rounded-lg bg-cta pr-2.5 pl-3.5 text-[13.5px] font-semibold text-white hover:bg-cta-hover disabled:opacity-70"
          >
            {busy === "confirm" && <LoaderCircle size={14} className="animate-spin" />}
            Confirmar
            <kbd className="rounded-md bg-white/15 px-[5px] py-px font-ui text-[11.5px] font-normal text-white/80">{mac ? "⌘↵" : "Ctrl ↵"}</kbd>
          </button>
          <button onClick={onEdit} disabled={busy !== null} className="h-9 rounded-lg border border-ink/12 bg-paper px-3.5 text-[13.5px] font-medium hover:bg-desk">
            Editar
          </button>
          <button
            onClick={() => run("cancel", onCancel)}
            disabled={busy !== null}
            className="h-9 rounded-lg px-3.5 text-[13.5px] font-medium text-ink-2 hover:bg-rule/60"
          >
            Cancelar
          </button>
        </div>
      )}
    </div>
  );
}

export function TicketSelector({
  part,
  interactive,
  onPick,
}: {
  part: Extract<MessagePart, { kind: "ticket_selector" }>;
  interactive: boolean;
  onPick: (text: string) => void;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  return (
    <div role="radiogroup" aria-label="Escolha um chamado" className="w-full max-w-[680px] overflow-hidden rounded-2xl border border-ink/9 bg-paper">
      {part.tickets.map((t, i) => (
        <button
          key={t.number}
          role="radio"
          aria-checked={picked === t.number}
          disabled={!interactive}
          onClick={() => {
            setPicked(t.number);
            onPick(`${t.number} · ${t.title}`);
          }}
          className={cx(
            "flex h-[46px] w-full items-center gap-3.5 px-4 text-left enabled:hover:bg-cta/4 disabled:cursor-default",
            i > 0 && "border-t border-rule",
            picked === t.number && "bg-cta/4",
          )}
        >
          <span className={cx("grid size-4 shrink-0 place-items-center rounded-full border", picked === t.number ? "border-cta" : "border-ink/20")}>
            {picked === t.number && <span className="size-2 rounded-full bg-cta" />}
          </span>
          <span className="w-[76px] shrink-0 text-[12.5px] font-medium text-ink-3">{t.number}</span>
          <span className="min-w-0 flex-1 truncate text-[14.5px] font-medium">{t.title}</span>
          <span className="hidden items-center gap-1.5 text-[12.5px] text-ink-3 sm:flex">
            <Dot className={STATUS_DOT[t.status]} />
            {t.statusLabel}
          </span>
          <span className="w-11 shrink-0 text-right text-[12.5px] text-ink-3">{formatDate(t.updatedAt)}</span>
        </button>
      ))}
    </div>
  );
}

export function Options({
  part,
  interactive,
  onPick,
}: {
  part: Extract<MessagePart, { kind: "options" }>;
  interactive: boolean;
  onPick: (text: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      {part.question && <p className="text-[14.5px] font-semibold">{part.question}</p>}
      <div className="flex flex-wrap gap-1.5">
        {part.options.map((o, i) => (
          <button
            key={o}
            disabled={!interactive}
            onClick={() => onPick(o)}
            className="flex items-center gap-[7px] rounded-lg border border-rule bg-paper py-[7px] pr-3 pl-2 text-[13.5px] font-medium enabled:hover:border-primary enabled:hover:bg-primary-soft enabled:hover:text-primary-text disabled:cursor-default disabled:text-ink-3"
          >
            {interactive && <span className="grid size-4 place-items-center rounded-md bg-desk text-[11px] text-ink-3">{i + 1}</span>}
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ArticleChips({ part }: { part: Extract<MessagePart, { kind: "articles" }> }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[12.5px] text-ink-3">
      <span>Central de ajuda:</span>
      {part.articles.map((a) => (
        <span key={a.code} className="rounded-full bg-desk px-2.5 py-1 text-ink-2">
          {a.title}
        </span>
      ))}
    </div>
  );
}
