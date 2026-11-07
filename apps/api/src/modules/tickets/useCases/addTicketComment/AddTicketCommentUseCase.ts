import { inject, injectable } from "tsyringe";
import { isStaff, type IActor } from "@modules/accounts/dtos/IActor";
import type { IUsersRepository } from "@modules/accounts/repositories/IUsersRepository";
import { canReopen, isOpen } from "@modules/tickets/domain/ticketRules";
import { TicketMap, type ITicketResponseDTO } from "@modules/tickets/mapper/TicketMap";
import type { ITicketsRepository } from "@modules/tickets/repositories/ITicketsRepository";
import { findVisibleTicket } from "@modules/tickets/utils/findVisibleTicket";
import { AppError } from "@shared/errors/AppError";

interface IRequest {
  actor: IActor;
  number: string;
  body: string;
  /** Reabre um chamado resolvido há até 7 dias. */
  reopen?: boolean;
}

/** Complementa um chamado com nova informação (e opcionalmente o reabre). */
@injectable()
export class AddTicketCommentUseCase {
  constructor(
    @inject("TicketsRepository") private ticketsRepository: ITicketsRepository,
    @inject("UsersRepository") private usersRepository: IUsersRepository,
  ) {}

  async execute({ actor, number, body, reopen = false }: IRequest): Promise<ITicketResponseDTO> {
    const ticket = await findVisibleTicket(this.ticketsRepository, actor, number);

    if (reopen) {
      if (!canReopen(ticket)) throw new AppError("Só dá para reabrir chamados resolvidos há até 7 dias.", 409);
      ticket.status = "aberto";
      ticket.resolvedAt = null;
    } else if (!isOpen(ticket.status)) {
      throw new AppError("Esse chamado está encerrado. Abra um novo ou reabra se foi resolvido há até 7 dias.", 409);
    } else if (ticket.status === "aguardando_funcionario" && !isStaff(actor)) {
      ticket.status = "aberto"; // o funcionário respondeu: volta para a fila
    }

    const author = await this.usersRepository.findById(actor.id);
    await this.ticketsRepository.addComment({ ticketId: ticket.id, authorId: actor.id, authorName: author?.name ?? "Usuário", body: body.trim() });
    // Salvar atualiza updated_at, que é a referência do prazo.
    return TicketMap.toDTO(await this.ticketsRepository.save(ticket));
  }
}
