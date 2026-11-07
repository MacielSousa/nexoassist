import type { SupportTeam } from "@modules/accounts/dtos/UserRole";
import type { Affected, Category, Priority, Severity, TicketType } from "@modules/tickets/domain/ticketRules";
import type { ITicketResponseDTO } from "@modules/tickets/mapper/TicketMap";

// Tipos do atendimento: conversa, mensagens, cards que o agent mostra e o trace de decisão.

/** agent → (transferência) waiting_human → (analista assume) human → closed. */
export const CONVERSATION_STATUSES = ["agent", "waiting_human", "human", "closed"] as const;
export type ConversationStatus = (typeof CONVERSATION_STATUSES)[number];

export const MESSAGE_ROLES = ["user", "assistant", "analyst", "system"] as const;
export type MessageRole = (typeof MESSAGE_ROLES)[number];

/** Limite de mensagens do funcionário por conversa (PRD). */
export const MESSAGE_LIMIT = 30;

export const HANDOFF_REASONS = ["pedido_do_funcionario", "critico", "prazo_vencido", "baixa_confianca", "fora_do_alcance"] as const;
export type HandoffReason = (typeof HANDOFF_REASONS)[number];

export const HANDOFF_REASON_LABEL: Record<HandoffReason, string> = {
  pedido_do_funcionario: "Funcionário pediu um analista",
  critico: "Caso crítico",
  prazo_vencido: "Chamado com prazo vencido",
  baixa_confianca: "Agent pediu ajuda",
  fora_do_alcance: "Agent não consegue resolver",
};

export interface IHandoff {
  reason: HandoffReason;
  summary: string;
  ticketNumber?: string;
  group: SupportTeam;
  confidence?: number;
}

// ---- Rascunhos: o agent nunca cria/atualiza chamado sem o funcionário confirmar ----

export type DraftKind = "create" | "update";
export type DraftStatus = "pending" | "confirmed" | "cancelled" | "superseded" | "failed";

export interface IDraftPayload {
  kind: DraftKind;
  type: TicketType;
  title: string;
  description: string;
  category: Category;
  affected: Affected;
  /** Fatos que definem a prioridade (só em "create"). */
  severity?: Severity;
  sameDayCommitment?: boolean;
  /** Prévia calculada pelas regras, para o card. */
  priority: Priority;
  priorityReason: string;
  slaLabel: string;
  deadline: string;
  /** Em "update": chamado alvo, informação nova e se reabre. */
  ticketNumber?: string;
  comment?: string;
  reopen?: boolean;
}

// ---- Cards que acompanham uma mensagem do agent ----

export type TicketCard = Omit<ITicketResponseDTO, "comments">;

export type MessagePart =
  | { kind: "options"; question?: string; options: string[] }
  | { kind: "ticket_selector"; tickets: Pick<TicketCard, "number" | "title" | "status" | "statusLabel" | "updatedAt">[] }
  | { kind: "ticket"; ticket: TicketCard }
  | { kind: "draft"; draftId: string }
  | { kind: "articles"; articles: { code: string; title: string }[] };

// ---- Transparência: o que o agent entendeu e fez em cada resposta ----

export interface IDecision {
  intent: string;
  confidence: number;
  rationale: string;
}

export interface IToolTrace {
  tool: string;
  label: string;
  input: unknown;
  output: unknown;
  ok: boolean;
  ms: number;
}

export interface ITurnTrace {
  decision: IDecision | null;
  tools: IToolTrace[];
  model: string;
  latencyMs: number;
  usage: { inputTokens: number; outputTokens: number };
  error?: string;
}
