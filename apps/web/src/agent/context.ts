import { canReopen, slaStatus, STATUS_LABEL, SLA_LABEL, type Ticket } from "@/domain";
import type { ServiceDeskClient } from "./service-desk-client";
import type { Decision, DraftInput, DraftView, HandoffInput, MessagePart, TicketView, ToolTrace } from "./types";

// Contexto de um turno. É montado pelo servidor a partir da sessão autenticada e
// injetado nas tools via RequestContext: o LLM nunca escolhe de quem são os dados.

export interface TurnContext {
  employee: { id: string; name: string; department: string };
  client: ServiceDeskClient;
  now: Date;
  createDraft(input: DraftInput): Promise<DraftView>;
  requestHandoff(input: HandoffInput): Promise<void>;
  recorder: TurnRecorder;
}

export class TurnRecorder {
  readonly steps: string[] = [];
  readonly parts: MessagePart[] = [];
  readonly tools: ToolTrace[] = [];
  decision: Decision | null = null;
  handoff: HandoffInput | null = null;
  /** Chamados vistos neste turno, para montar o seletor sem nova chamada ao serviço. */
  readonly seenTickets = new Map<string, Ticket>();

  step(label: string) {
    if (!this.steps.includes(label)) this.steps.push(label);
  }

  part(part: MessagePart) {
    this.parts.push(part);
  }

  async trace<T>(tool: string, label: string, input: unknown, fn: () => Promise<T>): Promise<T> {
    const started = Date.now();
    try {
      const output = await fn();
      this.tools.push({ tool, label, input, output: summarize(output), ok: true, ms: Date.now() - started });
      return output;
    } catch (err) {
      this.tools.push({ tool, label, input, output: String(err instanceof Error ? err.message : err), ok: false, ms: Date.now() - started });
      throw err;
    }
  }
}

/** Mantém o trace legível: listas longas e textos grandes são resumidos. */
function summarize(value: unknown, depth = 0): unknown {
  if (typeof value === "string") return value.length > 280 ? `${value.slice(0, 280)}…` : value;
  if (Array.isArray(value)) {
    const items = value.slice(0, 6).map((v) => summarize(v, depth + 1));
    return value.length > 6 ? [...items, `… +${value.length - 6}`] : items;
  }
  if (value && typeof value === "object") {
    if (depth > 3) return "{…}";
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, summarize(v, depth + 1)]));
  }
  return value;
}

export function toTicketView(t: Ticket, now: Date): TicketView {
  const sla = slaStatus(t, now);
  return {
    number: t.number,
    type: t.type,
    title: t.title,
    description: t.description,
    category: t.category,
    priority: t.priority,
    status: t.status,
    statusLabel: STATUS_LABEL[t.status],
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    slaLabel: SLA_LABEL[t.priority],
    deadline: sla.deadline,
    overdue: sla.overdue,
    canReopen: canReopen(t, now),
  };
}
