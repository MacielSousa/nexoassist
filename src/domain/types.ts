import { z } from "zod";

// Vocabulário do service desk (Anexo A do PRD).

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
  aguardando_funcionario: "Aguardando você",
  aprovado: "Aprovado",
  resolvido: "Resolvido",
  fechado: "Fechado",
};

/** Status em que o chamado ainda está "vivo" para o funcionário. */
export const OPEN_STATUSES: readonly TicketStatus[] = [
  "aberto",
  "em_andamento",
  "aguardando_analista",
  "aguardando_funcionario",
  "aprovado",
];

export function isOpen(status: TicketStatus): boolean {
  return OPEN_STATUSES.includes(status);
}

export const AFFECTED = ["individual", "equipe", "empresa"] as const;
export type Affected = (typeof AFFECTED)[number];

export const AFFECTED_LABEL: Record<Affected, string> = {
  individual: "Somente você",
  equipe: "Sua equipe",
  empresa: "Toda a empresa",
};

export const ticketCommentSchema = z.object({
  at: z.string(),
  author: z.string(),
  text: z.string(),
});
export type TicketComment = z.infer<typeof ticketCommentSchema>;

export const ticketSchema = z.object({
  number: z.string(),
  type: z.enum(TICKET_TYPES),
  title: z.string(),
  description: z.string(),
  category: z.enum(CATEGORIES),
  priority: z.enum(PRIORITIES),
  status: z.enum(STATUSES),
  requesterId: z.string(),
  affected: z.enum(AFFECTED),
  createdAt: z.string(),
  updatedAt: z.string(),
  resolvedAt: z.string().nullable(),
  assignedGroup: z.string().nullable(),
  comments: z.array(ticketCommentSchema),
});
export type Ticket = z.infer<typeof ticketSchema>;

export const articleSchema = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string(),
  category: z.enum(CATEGORIES),
  tags: z.array(z.string()),
});
export type Article = z.infer<typeof articleSchema>;

export const newTicketSchema = z.object({
  type: z.enum(TICKET_TYPES),
  title: z.string().min(5).max(120),
  description: z.string().min(10).max(2000),
  category: z.enum(CATEGORIES),
  priority: z.enum(PRIORITIES),
  affected: z.enum(AFFECTED),
});
export type NewTicket = z.infer<typeof newTicketSchema>;

export const ticketUpdateSchema = z.object({
  comment: z.string().min(3).max(2000),
  reopen: z.boolean().optional(),
});
export type TicketUpdate = z.infer<typeof ticketUpdateSchema>;
