import { inject, injectable } from "tsyringe";
import type { IActor } from "@modules/accounts/dtos/IActor";
import { TicketMap, type ITicketResponseDTO } from "@modules/tickets/mapper/TicketMap";
import type { ITicketsRepository } from "@modules/tickets/repositories/ITicketsRepository";
import { findVisibleTicket } from "@modules/tickets/utils/findVisibleTicket";

@injectable()
export class ShowTicketUseCase {
  constructor(@inject("TicketsRepository") private ticketsRepository: ITicketsRepository) {}

  async execute({ actor, number }: { actor: IActor; number: string }): Promise<ITicketResponseDTO> {
    const ticket = await findVisibleTicket(this.ticketsRepository, actor, number);
    const comments = await this.ticketsRepository.listComments(ticket.id);
    return TicketMap.toDTO(ticket, new Date(), comments);
  }
}
