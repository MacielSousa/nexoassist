import { inject, injectable } from "tsyringe";
import { isStaff, type IActor } from "@modules/accounts/dtos/IActor";
import type { IUsersRepository } from "@modules/accounts/repositories/IUsersRepository";
import { STATUS_LABEL, type TicketStatus } from "@modules/tickets/domain/ticketRules";
import { TicketMap, type ITicketResponseDTO } from "@modules/tickets/mapper/TicketMap";
import type { ITicketsRepository } from "@modules/tickets/repositories/ITicketsRepository";
import { findVisibleTicket } from "@modules/tickets/utils/findVisibleTicket";
import { AppError } from "@shared/errors/AppError";

/** Mudança de status feita por analista (ou admin). Fica registrada no histórico. */
@injectable()
export class UpdateTicketStatusUseCase {
  constructor(
    @inject("TicketsRepository") private ticketsRepository: ITicketsRepository,
    @inject("UsersRepository") private usersRepository: IUsersRepository,
  ) {}

  async execute({ actor, number, status }: { actor: IActor; number: string; status: TicketStatus }): Promise<ITicketResponseDTO> {
    if (!isStaff(actor)) throw new AppError("Só analistas alteram o status de um chamado.", 403);
    const ticket = await findVisibleTicket(this.ticketsRepository, actor, number);
    if (ticket.status === status) return TicketMap.toDTO(ticket);

    ticket.status = status;
    const finished = status === "resolvido" || status === "fechado";
    ticket.resolvedAt = finished ? new Date() : null;
    ticket.resolvedById = finished ? actor.id : null;
    if (status === "em_andamento") ticket.assignedAnalystId = actor.id;

    const analyst = await this.usersRepository.findById(actor.id);
    await this.ticketsRepository.addComment({
      ticketId: ticket.id,
      authorId: actor.id,
      authorName: analyst?.name ?? "Analista",
      body: `Status alterado para "${STATUS_LABEL[status]}".`,
    });
    return TicketMap.toDTO(await this.ticketsRepository.save(ticket));
  }
}
