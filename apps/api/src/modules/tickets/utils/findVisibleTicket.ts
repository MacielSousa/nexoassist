import { can, type IActor } from "@modules/accounts/dtos/IActor";
import type { Ticket } from "@modules/tickets/infra/typeorm/entities/Ticket";
import type { ITicketsRepository } from "@modules/tickets/repositories/ITicketsRepository";
import { AppError } from "@shared/errors/AppError";

/**
 * Busca um chamado respeitando a privacidade: quem não tem tickets.view_all só enxerga os próprios.
 * Para eles, um chamado alheio responde 404 (não revela que existe).
 */
export async function findVisibleTicket(repository: ITicketsRepository, actor: IActor, number: string): Promise<Ticket> {
  const ticket = await repository.findByNumber(number);
  if (!ticket || (!can(actor, "tickets.view_all") && ticket.requesterId !== actor.id)) {
    throw new AppError("Chamado não encontrado.", 404);
  }
  return ticket;
}
