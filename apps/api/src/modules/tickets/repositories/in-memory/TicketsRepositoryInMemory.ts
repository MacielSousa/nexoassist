import { randomUUID } from "node:crypto";
import type { TicketType } from "@modules/tickets/domain/ticketRules";
import type { ICreateTicketDTO, IListTicketsFilter } from "@modules/tickets/dtos/ICreateTicketDTO";
import { Ticket } from "@modules/tickets/infra/typeorm/entities/Ticket";
import { TicketComment } from "@modules/tickets/infra/typeorm/entities/TicketComment";
import type { ITicketsRepository } from "../ITicketsRepository";

export class TicketsRepositoryInMemory implements ITicketsRepository {
  tickets: Ticket[] = [];
  comments: TicketComment[] = [];
  private sequences: Record<TicketType, number> = { INC: 20520, REQ: 10461 };

  async nextNumber(type: TicketType) {
    return `${type}-${this.sequences[type]++}`;
  }

  async create(data: ICreateTicketDTO) {
    const now = new Date();
    const ticket = Object.assign(new Ticket(), { ...data, id: randomUUID(), assignedAnalystId: null, resolvedAt: null, resolvedById: null, createdAt: now, updatedAt: now });
    this.tickets.push(ticket);
    return ticket;
  }

  /** Como o @UpdateDateColumn do TypeORM: salvar marca a atualização como agora. */
  async save(ticket: Ticket) {
    ticket.updatedAt = new Date();
    return ticket;
  }

  async findByNumber(number: string) {
    return this.tickets.find((t) => t.number === number.toUpperCase()) ?? null;
  }

  async findByIdempotencyKey(key: string) {
    return this.tickets.find((t) => t.idempotencyKey === key) ?? null;
  }

  async list({ requesterId, status, search, limit = 100 }: IListTicketsFilter) {
    const q = search?.toLowerCase();
    return this.tickets
      .filter((t) => (!requesterId || t.requesterId === requesterId) && (!status?.length || status.includes(t.status)))
      .filter((t) => !q || t.title.toLowerCase().includes(q) || t.number.toLowerCase().includes(q))
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(0, limit);
  }

  async addComment(data: { ticketId: string; authorId: string | null; authorName: string; body: string }) {
    const comment = Object.assign(new TicketComment(), { ...data, id: randomUUID(), createdAt: new Date() });
    this.comments.push(comment);
    return comment;
  }

  async listComments(ticketId: string) {
    return this.comments.filter((c) => c.ticketId === ticketId);
  }
}
