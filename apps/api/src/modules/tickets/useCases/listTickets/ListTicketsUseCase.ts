import { inject, injectable } from "tsyringe";
import { can, type IActor } from "@modules/accounts/dtos/IActor";
import { OPEN_STATUSES } from "@modules/tickets/domain/ticketRules";
import { TicketMap, type ITicketResponseDTO } from "@modules/tickets/mapper/TicketMap";
import type { ITicketsRepository } from "@modules/tickets/repositories/ITicketsRepository";
import { AppError } from "@shared/errors/AppError";

interface IRequest {
  actor: IActor;
  /** Com tickets.view_all dá para filtrar por solicitante; sem, sempre os próprios. */
  requesterId?: string;
  scope: "open" | "all";
  search?: string;
}

@injectable()
export class ListTicketsUseCase {
  constructor(@inject("TicketsRepository") private ticketsRepository: ITicketsRepository) {}

  async execute({ actor, requesterId, scope, search }: IRequest): Promise<ITicketResponseDTO[]> {
    const seesAll = can(actor, "tickets.view_all");
    if (!seesAll && !can(actor, "tickets.view_own")) throw new AppError("Você não tem permissão para ver chamados.", 403);
    if (!seesAll && requesterId && requesterId !== actor.id) {
      throw new AppError("Você só pode consultar os próprios chamados.", 403);
    }
    const tickets = await this.ticketsRepository.list({
      requesterId: seesAll ? requesterId : actor.id,
      status: scope === "open" ? [...OPEN_STATUSES] : undefined,
      search,
    });
    const now = new Date();
    return tickets.map((t) => TicketMap.toDTO(t, now));
  }
}
