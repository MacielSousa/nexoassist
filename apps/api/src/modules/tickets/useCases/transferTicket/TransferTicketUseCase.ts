import { inject, injectable } from "tsyringe";
import type { IActor } from "@modules/accounts/dtos/IActor";
import type { SupportTeam } from "@modules/accounts/dtos/UserRole";
import { TicketMap, type ITicketResponseDTO } from "@modules/tickets/mapper/TicketMap";
import type { ITicketsRepository } from "@modules/tickets/repositories/ITicketsRepository";
import { findVisibleTicket } from "@modules/tickets/utils/findVisibleTicket";

/** Encaminha o chamado para uma fila de analistas, com o resumo do atendimento. */
@injectable()
export class TransferTicketUseCase {
  constructor(@inject("TicketsRepository") private ticketsRepository: ITicketsRepository) {}

  async execute({ actor, number, group, summary }: { actor: IActor; number: string; group: SupportTeam; summary: string }): Promise<ITicketResponseDTO> {
    const ticket = await findVisibleTicket(this.ticketsRepository, actor, number);
    ticket.status = "aguardando_analista";
    ticket.assignedGroup = group;
    await this.ticketsRepository.addComment({ ticketId: ticket.id, authorId: null, authorName: "Nexo Assist", body: `Transferido para ${group}. ${summary}` });
    return TicketMap.toDTO(await this.ticketsRepository.save(ticket));
  }
}
