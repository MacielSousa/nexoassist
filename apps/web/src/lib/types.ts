// Contrato com a API (apps/api). Espelha os DTOs documentados em /api-docs.

export type UserRole = "admin" | "analyst" | "employee";
export type SupportTeam = "Suporte N1" | "Suporte N2";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department: string;
  team: SupportTeam | null;
  active: boolean;
  initials: string;
  passwordChangedAt: string;
  createdAt: string;
}

export type TicketType = "INC" | "REQ";
export type Category = "Acesso" | "Rede e VPN" | "Hardware" | "Software" | "E-mail" | "Outros";
export type Priority = "Crítica" | "Alta" | "Média" | "Baixa";
export type TicketStatus = "aberto" | "em_andamento" | "aguardando_analista" | "aguardando_funcionario" | "aprovado" | "resolvido" | "fechado";
export type Affected = "individual" | "equipe" | "empresa";

export interface Ticket {
  id: string;
  number: string;
  type: TicketType;
  title: string;
  description: string;
  category: Category;
  priority: Priority;
  priorityReason: string;
  status: TicketStatus;
  statusLabel: string;
  affected: Affected;
  requesterId: string;
  assignedGroup: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  slaLabel: string;
  deadline: string;
  overdue: boolean;
  canReopen: boolean;
  comments?: { id: string; authorName: string; body: string; createdAt: string }[];
}

export type TicketCard = Omit<Ticket, "comments">;

export type ConversationStatus = "agent" | "waiting_human" | "human" | "closed";
export type MessageRole = "user" | "assistant" | "analyst" | "system";

export interface Conversation {
  id: string;
  employee: { id: string; name: string; email: string; department: string; initials: string };
  status: ConversationStatus;
  assignedAnalyst: { id: string; name: string } | null;
  handoff: {
    reason: string;
    reasonLabel: string;
    summary: string;
    ticket: string | null;
    group: string;
    confidence: number | null;
    at: string;
    contactBy: string;
  } | null;
  resolvedBy: "agent" | "analyst" | null;
  userMessageCount: number;
  messageLimit: number;
  createdAt: string;
  updatedAt: string;
}

export type MessagePart =
  | { kind: "options"; question?: string; options: string[] }
  | { kind: "ticket_selector"; tickets: Pick<TicketCard, "number" | "title" | "status" | "statusLabel" | "updatedAt">[] }
  | { kind: "ticket"; ticket: TicketCard }
  | { kind: "draft"; draftId: string }
  | { kind: "articles"; articles: { code: string; title: string }[] };

export interface TurnTrace {
  decision: { intent: string; confidence: number; rationale: string } | null;
  tools: { tool: string; label: string; input: unknown; output: unknown; ok: boolean; ms: number }[];
  model: string;
  latencyMs: number;
  usage: { inputTokens: number; outputTokens: number };
  error?: string;
}

export interface Message {
  id: number;
  role: MessageRole;
  author: { id: string; name: string } | null;
  content: string;
  steps: string[];
  parts: MessagePart[];
  trace: TurnTrace | null;
  createdAt: string;
}

export interface Draft {
  id: string;
  status: "pending" | "confirmed" | "cancelled" | "superseded" | "failed";
  resultTicket: string | null;
  kind: "create" | "update";
  type: TicketType;
  title: string;
  description: string;
  category: Category;
  affected: Affected;
  priority: Priority;
  priorityReason: string;
  slaLabel: string;
  deadline: string;
  ticketNumber?: string;
  comment?: string;
  reopen?: boolean;
}

export interface ConversationSnapshot {
  conversation: Conversation;
  messages: Message[];
  drafts: Record<string, Draft>;
}

export interface ConsoleItem {
  conversation: Conversation;
  lastMessage: { role: MessageRole; content: string; createdAt: string } | null;
  unread: number;
}

/** Eventos do streaming da resposta do agent. */
export type ChatStreamEvent =
  | { type: "user"; message: Message }
  | { type: "steps"; steps: string[] }
  | { type: "text"; delta: string }
  | { type: "text-reset" }
  | { type: "done"; snapshot: ConversationSnapshot }
  | { type: "error"; error: string };

export const AFFECTED_LABEL: Record<Affected, string> = {
  individual: "Somente você",
  equipe: "Sua equipe",
  empresa: "Toda a empresa",
};

export const ROLE_LABEL: Record<UserRole, string> = {
  admin: "Admin",
  analyst: "Analista",
  employee: "Funcionário",
};

export const CATEGORIES: Category[] = ["Acesso", "Rede e VPN", "Hardware", "Software", "E-mail", "Outros"];
export const PRIORITIES: Priority[] = ["Crítica", "Alta", "Média", "Baixa"];

export const STATUS_LABEL: Record<TicketStatus, string> = {
  aberto: "Aberto",
  em_andamento: "Em andamento",
  aguardando_analista: "Aguardando analista",
  aguardando_funcionario: "Aguardando funcionário",
  aprovado: "Aprovado",
  resolvido: "Resolvido",
  fechado: "Fechado",
};

export const HANDOFF_REASON_LABEL: Record<string, string> = {
  pedido_do_funcionario: "Funcionário pediu",
  critico: "Caso crítico",
  prazo_vencido: "Prazo vencido",
  baixa_confianca: "Agent sem segurança",
  fora_do_alcance: "Fora do alcance do agent",
};

// ---- Relatórios ----

export interface ReportFilters {
  from: string;
  to: string;
  analystId?: string;
  team?: SupportTeam;
  category?: Category;
  priority?: Priority;
  type?: TicketType;
  status?: TicketStatus;
}

export interface Breakdown {
  key: string;
  count: number;
}

export interface ReportOverview {
  period: { from: string; to: string };
  tickets: {
    created: number;
    resolved: number;
    stillOpen: number;
    overdue: number;
    slaMetPercent: number | null;
    avgResolutionHours: number | null;
    byPriority: Breakdown[];
    byCategory: Breakdown[];
    byStatus: Breakdown[];
    byType: Breakdown[];
  };
  conversations: {
    total: number;
    resolvedByAgent: number;
    transferred: number;
    takenOver: number;
    avgTakeoverMinutes: number | null;
    byHandoffReason: Breakdown[];
  };
  analysts: {
    id: string;
    name: string;
    team: SupportTeam | null;
    conversationsTaken: number;
    conversationsClosed: number;
    avgTakeoverMinutes: number | null;
    ticketsResolved: number;
  }[];
  daily: { day: string; created: number; resolved: number }[];
}

export interface ReportTicketRow {
  number: string;
  type: TicketType;
  title: string;
  category: Category;
  priority: Priority;
  status: TicketStatus;
  requesterName: string;
  assignedGroup: string | null;
  resolvedByName: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
}

export interface ReportTicketsPage {
  page: number;
  pageSize: number;
  total: number;
  rows: ReportTicketRow[];
}
