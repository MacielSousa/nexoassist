import type { TicketType } from "../domain/ticketRules";
import type { ICreateTicketDTO, IListTicketsFilter } from "../dtos/ICreateTicketDTO";
import type { Ticket } from "../infra/typeorm/entities/Ticket";
import type { TicketComment } from "../infra/typeorm/entities/TicketComment";

export interface ITicketsRepository {
  /** Próximo número da sequência do tipo (INC-20520, REQ-10461...). */
  nextNumber(type: TicketType): Promise<string>;
  create(data: ICreateTicketDTO): Promise<Ticket>;
  save(ticket: Ticket): Promise<Ticket>;
  findByNumber(number: string): Promise<Ticket | null>;
  findByIdempotencyKey(key: string): Promise<Ticket | null>;
  list(filter: IListTicketsFilter): Promise<Ticket[]>;
  addComment(data: { ticketId: string; authorId: string | null; authorName: string; body: string }): Promise<TicketComment>;
  /** Comentários em ordem cronológica. */
  listComments(ticketId: string): Promise<TicketComment[]>;
}
