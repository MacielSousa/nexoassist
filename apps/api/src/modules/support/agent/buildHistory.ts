import type { MessagePart } from "../dtos/supportTypes";
import type { Draft } from "../infra/typeorm/entities/Draft";
import type { Message } from "../infra/typeorm/entities/Message";
import type { HistoryMessage } from "./runAgentTurn";

/** Quantas mensagens recentes vão para o modelo (custo por conversa). */
export const HISTORY_WINDOW = 20;

const DRAFT_STATUS_TEXT = { pending: "aguardando confirmação", cancelled: "cancelado", superseded: "substituído", failed: "falhou" } as const;

/**
 * Converte o histórico salvo no formato do LLM. Os cards viram uma linha de texto
 * (ex.: "[rascunho D-381 — ...: confirmado (INC-20520)]") para o modelo saber o que o funcionário viu.
 */
export function buildHistory(messages: Message[], drafts: Draft[]): HistoryMessage[] {
  const draftsById = new Map(drafts.map((d) => [d.id, d]));

  const describe = (p: MessagePart): string => {
    switch (p.kind) {
      case "options":
        return `[opções mostradas: ${p.options.join(" | ")}]`;
      case "ticket_selector":
        return `[seletor de chamados mostrado: ${p.tickets.map((t) => t.number).join(", ")}]`;
      case "ticket":
        return `[card do chamado ${p.ticket.number}: ${p.ticket.statusLabel}, prioridade ${p.ticket.priority}${p.ticket.overdue ? ", vencido" : ""}]`;
      case "articles":
        return `[artigos: ${p.articles.map((a) => a.title).join("; ")}]`;
      case "draft": {
        const d = draftsById.get(p.draftId);
        if (!d) return "";
        const status = d.status === "confirmed" ? `confirmado (${d.resultTicket})` : DRAFT_STATUS_TEXT[d.status];
        return d.payload.kind === "create"
          ? `[rascunho ${d.id} — "${d.payload.title}", ${d.payload.category}, prioridade ${d.payload.priority}: ${status}]`
          : `[rascunho ${d.id} — ${d.payload.reopen ? "reabrir" : "atualizar"} ${d.payload.ticketNumber}: ${status}]`;
      }
    }
  };

  const out: HistoryMessage[] = [];
  for (const m of messages.slice(-HISTORY_WINDOW)) {
    const role: HistoryMessage["role"] = m.role === "user" ? "user" : "assistant";
    const content =
      m.role === "user"
        ? m.content
        : m.role === "assistant"
          ? [m.content, ...m.parts.map(describe)].filter(Boolean).join("\n")
          : m.role === "analyst"
            ? `[analista ${m.authorName ?? ""}] ${m.content}`
            : `[sistema] ${m.content}`;
    if (!content) continue;
    // Mensagens seguidas do mesmo papel viram uma só (alguns provedores exigem alternância).
    const prev = out[out.length - 1];
    if (prev && prev.role === role) prev.content += `\n\n${content}`;
    else out.push({ role, content } as HistoryMessage);
  }
  while (out[0]?.role === "assistant") out.shift();
  return out;
}
