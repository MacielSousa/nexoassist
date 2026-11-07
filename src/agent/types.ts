import type { Affected, Category, Priority, TicketStatus, TicketType } from "@/domain";

// Contratos entre o agent, o servidor (que persiste) e a interface (que renderiza).

export interface TicketView {
  number: string;
  type: TicketType;
  title: string;
  description: string;
  category: Category;
  priority: Priority;
  status: TicketStatus;
  statusLabel: string;
  createdAt: string;
  updatedAt: string;
  slaLabel: string;
  deadline: string;
  overdue: boolean;
  canReopen: boolean;
}

export type DraftKind = "create" | "update";
export type DraftStatus = "pending" | "confirmed" | "cancelled" | "superseded" | "failed";

export interface DraftView {
  id: string;
  kind: DraftKind;
  status: DraftStatus;
  type: TicketType;
  title: string;
  description: string;
  category: Category;
  priority: Priority;
  priorityReason: string;
  affected: Affected;
  slaLabel: string;
  /** Prazo da primeira resposta se o chamado for criado agora. */
  deadline: string;
  /** Atualização: chamado alvo, comentário e se reabre. */
  ticketNumber?: string;
  comment?: string;
  reopen?: boolean;
  /** Preenchido depois da confirmação. */
  resultTicket?: string;
}

export type DraftInput = Omit<DraftView, "id" | "status" | "resultTicket">;

export type MessagePart =
  | { kind: "options"; question?: string; options: string[] }
  | { kind: "ticket_selector"; tickets: Pick<TicketView, "number" | "title" | "status" | "statusLabel" | "updatedAt">[] }
  | { kind: "ticket"; ticket: TicketView }
  | { kind: "draft"; draftId: string }
  | { kind: "articles"; articles: { id: string; title: string }[] };

export const HANDOFF_REASONS = [
  "pedido_do_funcionario",
  "critico",
  "prazo_vencido",
  "baixa_confianca",
  "fora_do_alcance",
] as const;
export type HandoffReason = (typeof HANDOFF_REASONS)[number];

export const HANDOFF_REASON_LABEL: Record<HandoffReason, string> = {
  pedido_do_funcionario: "Funcionário pediu um analista",
  critico: "Caso crítico",
  prazo_vencido: "Chamado com prazo vencido",
  baixa_confianca: "Agent pediu ajuda",
  fora_do_alcance: "Agent não consegue resolver",
};

export interface HandoffInput {
  reason: HandoffReason;
  summary: string;
  ticketNumber?: string;
  group: "Suporte N1" | "Suporte N2";
  confidence?: number;
}

export interface Decision {
  intent: string;
  confidence: number;
  rationale: string;
}

export interface ToolTrace {
  tool: string;
  label: string;
  input: unknown;
  output: unknown;
  ok: boolean;
  ms: number;
}

/** Registro de tudo que o agent fez num turno, para a transparência na interface. */
export interface TurnTrace {
  decision: Decision | null;
  tools: ToolTrace[];
  model: string;
  latencyMs: number;
  usage: { inputTokens: number; outputTokens: number };
  error?: string;
}
