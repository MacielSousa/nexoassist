import { z } from "zod";
import {
  AFFECTED,
  canReopen,
  CATEGORIES,
  isOverdue,
  PRIORITIES,
  SLA_LABEL,
  slaDeadline,
  STATUS_LABEL,
  STATUSES,
  TICKET_TYPES,
} from "../domain/ticketRules";
import type { Ticket } from "../infra/typeorm/entities/Ticket";
import type { TicketComment } from "../infra/typeorm/entities/TicketComment";

export const TicketCommentSchema = z
  .object({ id: z.uuid(), authorName: z.string(), body: z.string(), createdAt: z.iso.datetime() })
  .meta({ id: "TicketComment" });

/** Chamado como a API devolve: com rótulos e prazo já calculados. */
export const TicketResponseSchema = z
  .object({
    id: z.uuid(),
    number: z.string().meta({ example: "INC-20311" }),
    type: z.enum(TICKET_TYPES),
    title: z.string(),
    description: z.string(),
    category: z.enum(CATEGORIES),
    priority: z.enum(PRIORITIES),
    priorityReason: z.string(),
    status: z.enum(STATUSES),
    statusLabel: z.string(),
    affected: z.enum(AFFECTED),
    requesterId: z.uuid(),
    assignedGroup: z.string().nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    resolvedAt: z.iso.datetime().nullable(),
    slaLabel: z.string().meta({ description: "Prazo contratado, ex.: 3 dias úteis" }),
    deadline: z.iso.datetime().meta({ description: "Prazo da próxima resposta (a partir da última atualização)" }),
    overdue: z.boolean(),
    canReopen: z.boolean(),
    comments: z.array(TicketCommentSchema).optional(),
  })
  .meta({ id: "Ticket" });

export type ITicketResponseDTO = z.infer<typeof TicketResponseSchema>;

export class TicketMap {
  static toDTO(ticket: Ticket, now = new Date(), comments?: TicketComment[]): ITicketResponseDTO {
    return {
      id: ticket.id,
      number: ticket.number,
      type: ticket.type,
      title: ticket.title,
      description: ticket.description,
      category: ticket.category,
      priority: ticket.priority,
      priorityReason: ticket.priorityReason,
      status: ticket.status,
      statusLabel: STATUS_LABEL[ticket.status],
      affected: ticket.affected,
      requesterId: ticket.requesterId,
      assignedGroup: ticket.assignedGroup,
      createdAt: ticket.createdAt.toISOString(),
      updatedAt: ticket.updatedAt.toISOString(),
      resolvedAt: ticket.resolvedAt?.toISOString() ?? null,
      slaLabel: SLA_LABEL[ticket.priority],
      deadline: slaDeadline(ticket.priority, ticket.updatedAt).toISOString(),
      overdue: isOverdue(ticket, now),
      canReopen: canReopen(ticket, now),
      comments: comments?.map((c) => ({ id: c.id, authorName: c.authorName, body: c.body, createdAt: c.createdAt.toISOString() })),
    };
  }
}
