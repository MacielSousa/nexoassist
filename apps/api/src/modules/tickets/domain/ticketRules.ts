// Vocabulário e regras do service desk (Anexo A do PRD).
// Tudo aqui é puro (sem banco, sem HTTP) para ser fácil de ler e de testar.

import { addBusinessDays, addBusinessHours } from "./businessHours";

export const TICKET_TYPES = ["INC", "REQ"] as const;
export type TicketType = (typeof TICKET_TYPES)[number];

export const CATEGORIES = ["Acesso", "Rede e VPN", "Hardware", "Software", "E-mail", "Outros"] as const;
export type Category = (typeof CATEGORIES)[number];

export const PRIORITIES = ["Crítica", "Alta", "Média", "Baixa"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const STATUSES = [
  "aberto",
  "em_andamento",
  "aguardando_analista",
  "aguardando_funcionario",
  "aprovado",
  "resolvido",
  "fechado",
] as const;
export type TicketStatus = (typeof STATUSES)[number];

export const STATUS_LABEL: Record<TicketStatus, string> = {
  aberto: "Aberto",
  em_andamento: "Em andamento",
  aguardando_analista: "Aguardando analista",
  aguardando_funcionario: "Aguardando funcionário",
  aprovado: "Aprovado",
  resolvido: "Resolvido",
  fechado: "Fechado",
};

/** Status em que o chamado ainda está "vivo". */
export const OPEN_STATUSES: readonly TicketStatus[] = ["aberto", "em_andamento", "aguardando_analista", "aguardando_funcionario", "aprovado"];
export const isOpen = (status: TicketStatus) => OPEN_STATUSES.includes(status);

export const AFFECTED = ["individual", "equipe", "empresa"] as const;
export type Affected = (typeof AFFECTED)[number];

export const SEVERITIES = ["parado", "impede_trabalho", "atrapalha", "sem_urgencia"] as const;
export type Severity = (typeof SEVERITIES)[number];

// ---------------------------------------------------------------------------
// Prioridade = impacto (quantas pessoas) × urgência (se há compromisso em risco).
// O LLM só extrai os fatos; a classificação é determinística e auditável.

export interface PriorityInput {
  affected: Affected;
  severity: Severity;
  /** Há um compromisso no mesmo dia que depende da solução (reunião, entrega, cliente). */
  sameDayCommitment: boolean;
}

export function classifyPriority({ affected, severity, sameDayCommitment }: PriorityInput): { priority: Priority; reason: string } {
  const stopped = severity === "parado" || severity === "impede_trabalho";
  if (affected !== "individual" && stopped) {
    return { priority: "Crítica", reason: affected === "empresa" ? "Algo parado para a empresa." : "Algo parado para uma equipe." };
  }

  const base: Record<Severity, { priority: Priority; reason: string }> = {
    parado: { priority: "Alta", reason: "Impede uma pessoa de trabalhar." },
    impede_trabalho: { priority: "Alta", reason: "Impede uma pessoa de trabalhar." },
    atrapalha: { priority: "Média", reason: "Atrapalha, mas há alternativa." },
    sem_urgencia: { priority: "Baixa", reason: "Pedido ou melhoria sem urgência." },
  };
  const decision = { ...base[severity] };

  if (sameDayCommitment) {
    if (decision.priority === "Média" || decision.priority === "Baixa") {
      return { priority: "Alta", reason: "Há um compromisso no mesmo dia." };
    }
    decision.reason += " Há um compromisso no mesmo dia.";
  }
  return decision;
}

// ---------------------------------------------------------------------------
// Prazos (SLA). O prazo vale para a primeira resposta e para cada atualização.

export const SLA_LABEL: Record<Priority, string> = {
  Crítica: "1 hora",
  Alta: "4 horas úteis",
  Média: "3 dias úteis",
  Baixa: "5 dias úteis",
};

export function slaDeadline(priority: Priority, from: Date): Date {
  switch (priority) {
    case "Crítica":
      return new Date(from.getTime() + 60 * 60 * 1000); // plantão 24 h: prazo corrido
    case "Alta":
      return addBusinessHours(from, 4);
    case "Média":
      return addBusinessDays(from, 3);
    case "Baixa":
      return addBusinessDays(from, 5);
  }
}

export function isOverdue(ticket: { priority: Priority; status: TicketStatus; updatedAt: Date }, now = new Date()): boolean {
  // Quando a bola está com o funcionário, o prazo do service desk não corre.
  const counting = isOpen(ticket.status) && ticket.status !== "aguardando_funcionario";
  return counting && now > slaDeadline(ticket.priority, ticket.updatedAt);
}

/** Janela em que um chamado resolvido pode ser reaberto, em vez de abrir um novo. */
export const REOPEN_WINDOW_DAYS = 7;

export function canReopen(ticket: { status: TicketStatus; resolvedAt: Date | null }, now = new Date()): boolean {
  if (ticket.status !== "resolvido" || !ticket.resolvedAt) return false;
  return now.getTime() - ticket.resolvedAt.getTime() <= REOPEN_WINDOW_DAYS * 24 * 60 * 60 * 1000;
}
