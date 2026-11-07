import type { IActor } from "@modules/accounts/dtos/IActor";
import type { SupportTeam } from "@modules/accounts/dtos/UserRole";
import type { TicketStatus } from "@modules/tickets/domain/ticketRules";
import type { ITicketResponseDTO } from "@modules/tickets/mapper/TicketMap";
import type { ICreateTicketRequest } from "@modules/tickets/useCases/createTicket/CreateTicketUseCase";
import type { IArticleResponseDTO } from "@modules/tickets/useCases/searchArticles/SearchArticlesUseCase";
import { AppError } from "@shared/errors/AppError";

/** O sistema de chamados não respondeu mesmo depois das novas tentativas. */
export class ServiceDeskUnavailableError extends AppError {
  constructor() {
    super("O sistema de chamados está indisponível no momento. Tente de novo em instantes.", 503);
  }
}

/**
 * Porta de entrada do agent (e do console) para o service desk. O agent nunca acessa
 * repositórios nem o banco: fala só com esta interface, como falaria com o sistema legado real.
 * Toda operação recebe quem está agindo, e as regras de privacidade valem aqui também.
 */
export interface IServiceDeskProvider {
  listTickets(actor: IActor, scope: "open" | "all", requesterId?: string): Promise<ITicketResponseDTO[]>;
  /** null quando não existe ou não é visível para quem pede. */
  getTicket(actor: IActor, number: string): Promise<ITicketResponseDTO | null>;
  createTicket(actor: IActor, data: ICreateTicketRequest, idempotencyKey: string): Promise<ITicketResponseDTO>;
  addComment(actor: IActor, number: string, body: string, reopen?: boolean): Promise<ITicketResponseDTO>;
  transfer(actor: IActor, number: string, group: SupportTeam, summary: string): Promise<ITicketResponseDTO>;
  setStatus(actor: IActor, number: string, status: TicketStatus): Promise<ITicketResponseDTO>;
  searchArticles(query: string): Promise<IArticleResponseDTO[]>;
}
