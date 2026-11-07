import { inject, injectable } from "tsyringe";
import { isStaff, type IActor } from "@modules/accounts/dtos/IActor";
import { OPEN_STATUSES } from "@modules/tickets/domain/ticketRules";
import { TicketMap, type ITicketResponseDTO } from "@modules/tickets/mapper/TicketMap";
import type { ITicketsRepository } from "@modules/tickets/repositories/ITicketsRepository";
import { AppError } from "@shared/errors/AppError";

interface IRequest {
  actor: IActor;
  /** Analistas e admins podem filtrar por solicitante; funcionários sempre veem os próprios. */
  requesterId?: string;
  scope: "open" | "all";
  search?: string;
}

@injectable()
export class ListTicketsUseCase {
  constructor(@inject("TicketsRepository") private ticketsRepository: ITicketsRepository) {}

  async execute({ actor, requesterId, scope, search }: IRequest): Promise<ITicketResponseDTO[]> {
    if (!isStaff(actor) && requesterId && requesterId !== actor.id) {
      throw new AppError("Você só pode consultar os próprios chamados.", 403);
    }
    const tickets = await this.ticketsRepository.list({
      requesterId: isStaff(actor) ? requesterId : actor.id,
      status: scope === "open" ? [...OPEN_STATUSES] : undefined,
      search,
    });
    const now = new Date();
    return tickets.map((t) => TicketMap.toDTO(t, now));
  }
}
