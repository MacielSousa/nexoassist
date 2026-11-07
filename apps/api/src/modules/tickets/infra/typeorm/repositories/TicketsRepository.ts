import { ILike, In, type FindOptionsWhere, type Repository } from "typeorm";
import type { TicketType } from "@modules/tickets/domain/ticketRules";
import type { ICreateTicketDTO, IListTicketsFilter } from "@modules/tickets/dtos/ICreateTicketDTO";
import type { ITicketsRepository } from "@modules/tickets/repositories/ITicketsRepository";
import { AppDataSource } from "@shared/infra/typeorm/data-source";
import { Ticket } from "../entities/Ticket";
import { TicketComment } from "../entities/TicketComment";

export class TicketsRepository implements ITicketsRepository {
  private repository: Repository<Ticket>;
  private comments: Repository<TicketComment>;

  constructor() {
    this.repository = AppDataSource.getRepository(Ticket);
    this.comments = AppDataSource.getRepository(TicketComment);
  }

  async nextNumber(type: TicketType): Promise<string> {
    const sequence = type === "INC" ? "ticket_inc_seq" : "ticket_req_seq";
    const [row] = (await AppDataSource.query(`SELECT nextval('${sequence}') AS value`)) as { value: string }[];
    return `${type}-${row!.value}`;
  }

  create(data: ICreateTicketDTO): Promise<Ticket> {
    return this.repository.save(this.repository.create(data));
  }

  save(ticket: Ticket): Promise<Ticket> {
    return this.repository.save(ticket);
  }

  findByNumber(number: string): Promise<Ticket | null> {
    return this.repository.findOneBy({ number: number.toUpperCase() });
  }

  findByIdempotencyKey(key: string): Promise<Ticket | null> {
    return this.repository.findOneBy({ idempotencyKey: key });
  }

  list({ requesterId, status, search, limit = 100 }: IListTicketsFilter): Promise<Ticket[]> {
    const base: FindOptionsWhere<Ticket> = {};
    if (requesterId) base.requesterId = requesterId;
    if (status?.length) base.status = In(status);
    const where = search ? [{ ...base, title: ILike(`%${search}%`) }, { ...base, number: ILike(`%${search}%`) }] : base;
    return this.repository.find({ where, order: { updatedAt: "DESC" }, take: limit });
  }

  addComment(data: { ticketId: string; authorId: string | null; authorName: string; body: string }): Promise<TicketComment> {
    return this.comments.save(this.comments.create(data));
  }

  listComments(ticketId: string): Promise<TicketComment[]> {
    return this.comments.find({ where: { ticketId }, order: { createdAt: "ASC" } });
  }
}
