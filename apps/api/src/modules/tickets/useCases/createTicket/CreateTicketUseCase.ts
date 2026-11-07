import { inject, injectable } from "tsyringe";
import type { IActor } from "@modules/accounts/dtos/IActor";
import { classifyPriority, type Affected, type Category, type Severity, type TicketType } from "@modules/tickets/domain/ticketRules";
import { TicketMap, type ITicketResponseDTO } from "@modules/tickets/mapper/TicketMap";
import type { ITicketsRepository } from "@modules/tickets/repositories/ITicketsRepository";
import { AppError } from "@shared/errors/AppError";

export interface ICreateTicketRequest {
  type: TicketType;
  title: string;
  description: string;
  category: Category;
  affected: Affected;
  severity: Severity;
  sameDayCommitment: boolean;
}

/**
 * Abre um chamado em nome de quem está autenticado. A prioridade é sempre calculada
 * pelas regras do service desk (nunca informada pelo cliente nem pelo LLM).
 */
@injectable()
export class CreateTicketUseCase {
  constructor(@inject("TicketsRepository") private ticketsRepository: ITicketsRepository) {}

  async execute({ actor, data, idempotencyKey }: { actor: IActor; data: ICreateTicketRequest; idempotencyKey?: string }): Promise<ITicketResponseDTO> {
    if (actor.role !== "employee") throw new AppError("Chamados são abertos por funcionários.", 403);

    // Mesma chave = mesmo pedido: devolve o chamado já criado em vez de duplicar.
    if (idempotencyKey) {
      const existing = await this.ticketsRepository.findByIdempotencyKey(idempotencyKey);
      if (existing) {
        if (existing.requesterId !== actor.id) throw new AppError("Chave de idempotência já usada.", 409);
        return TicketMap.toDTO(existing);
      }
    }

    const { priority, reason } = classifyPriority(data);
    const ticket = await this.ticketsRepository.create({
      number: await this.ticketsRepository.nextNumber(data.type),
      type: data.type,
      title: data.title.trim(),
      description: data.description.trim(),
      category: data.category,
      priority,
      priorityReason: reason,
      status: "aberto",
      affected: data.affected,
      requesterId: actor.id,
      assignedGroup: priority === "Crítica" ? "Plantão" : "Suporte N1",
      idempotencyKey: idempotencyKey ?? null,
    });
    return TicketMap.toDTO(ticket);
  }
}
