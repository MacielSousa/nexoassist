import { addBusinessDays, addBusinessHours } from "./business-hours";
import { isOpen, type Priority, type Ticket } from "./types";

// O prazo vale para a primeira resposta e para cada atualização; passado o prazo, o chamado está vencido.

export const SLA_LABEL: Record<Priority, string> = {
  Crítica: "1 hora",
  Alta: "4 horas úteis",
  Média: "3 dias úteis",
  Baixa: "5 dias úteis",
};

export function slaDeadline(priority: Priority, from: Date): Date {
  switch (priority) {
    case "Crítica":
      // Chamados críticos têm plantão 24 horas: prazo corrido.
      return new Date(from.getTime() + 60 * 60 * 1000);
    case "Alta":
      return addBusinessHours(from, 4);
    case "Média":
      return addBusinessDays(from, 3);
    case "Baixa":
      return addBusinessDays(from, 5);
  }
}

export interface SlaStatus {
  deadline: string;
  overdue: boolean;
  /** Prazo contratado, em texto ("3 dias úteis"). */
  label: string;
}

export function slaStatus(ticket: Pick<Ticket, "priority" | "status" | "updatedAt">, now: Date = new Date()): SlaStatus {
  const deadline = slaDeadline(ticket.priority, new Date(ticket.updatedAt));
  // Quando a bola está com o funcionário, o prazo do service desk não corre.
  const counting = isOpen(ticket.status) && ticket.status !== "aguardando_funcionario";
  return {
    deadline: deadline.toISOString(),
    overdue: counting && now.getTime() > deadline.getTime(),
    label: SLA_LABEL[ticket.priority],
  };
}

/** Janela em que um chamado resolvido ainda pode ser reaberto, em vez de abrir um novo. */
export const REOPEN_WINDOW_DAYS = 7;

export function canReopen(ticket: Pick<Ticket, "status" | "resolvedAt">, now: Date = new Date()): boolean {
  if (ticket.status !== "resolvido" || !ticket.resolvedAt) return false;
  const age = now.getTime() - new Date(ticket.resolvedAt).getTime();
  return age <= REOPEN_WINDOW_DAYS * 24 * 60 * 60 * 1000;
}
