import type { IActor } from "@modules/accounts/dtos/IActor";
import type { IServiceDeskProvider } from "@modules/tickets/providers/ServiceDeskProvider/IServiceDeskProvider";
import type { IDecision, IDraftPayload, IHandoff, IToolTrace, MessagePart, TicketCard } from "../dtos/supportTypes";

/**
 * Contexto de um turno do agent. Montado pelo use case a partir do token do funcionário
 * e entregue às tools pelo RequestContext do Mastra: o LLM nunca escolhe de quem são os dados.
 */
export interface ITurnContext {
  employee: { id: string; name: string; department: string };
  actor: IActor;
  serviceDesk: IServiceDeskProvider;
  now: Date;
  createDraft(payload: IDraftPayload): Promise<{ id: string }>;
  requestHandoff(handoff: IHandoff): Promise<void>;
  recorder: TurnRecorder;
}

/** Registra tudo o que o agent fez no turno, para a transparência ("Como decidi"). */
export class TurnRecorder {
  readonly steps: string[] = [];
  readonly parts: MessagePart[] = [];
  readonly tools: IToolTrace[] = [];
  decision: IDecision | null = null;
  handoff: IHandoff | null = null;
  /** Chamados vistos no turno, para montar o seletor sem consultar de novo. */
  readonly seenTickets = new Map<string, TicketCard>();

  step(label: string) {
    if (!this.steps.includes(label)) this.steps.push(label);
  }

  part(part: MessagePart) {
    this.parts.push(part);
  }

  async trace<T>(tool: string, label: string, input: unknown, run: () => Promise<T>): Promise<T> {
    const started = Date.now();
    try {
      const output = await run();
      this.tools.push({ tool, label, input, output: summarize(output), ok: true, ms: Date.now() - started });
      return output;
    } catch (err) {
      this.tools.push({ tool, label, input, output: err instanceof Error ? err.message : String(err), ok: false, ms: Date.now() - started });
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
