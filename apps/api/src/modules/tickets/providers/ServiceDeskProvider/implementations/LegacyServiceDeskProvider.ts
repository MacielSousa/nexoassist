import type { IActor } from "@modules/accounts/dtos/IActor";
import type { SupportTeam } from "@modules/accounts/dtos/UserRole";
import type { IUsersRepository } from "@modules/accounts/repositories/IUsersRepository";
import type { TicketStatus } from "@modules/tickets/domain/ticketRules";
import type { IArticlesRepository } from "@modules/tickets/repositories/IArticlesRepository";
import type { ITicketsRepository } from "@modules/tickets/repositories/ITicketsRepository";
import { AddTicketCommentUseCase } from "@modules/tickets/useCases/addTicketComment/AddTicketCommentUseCase";
import { CreateTicketUseCase, type ICreateTicketRequest } from "@modules/tickets/useCases/createTicket/CreateTicketUseCase";
import { ListTicketsUseCase } from "@modules/tickets/useCases/listTickets/ListTicketsUseCase";
import { SearchArticlesUseCase } from "@modules/tickets/useCases/searchArticles/SearchArticlesUseCase";
import { ShowTicketUseCase } from "@modules/tickets/useCases/showTicket/ShowTicketUseCase";
import { TransferTicketUseCase } from "@modules/tickets/useCases/transferTicket/TransferTicketUseCase";
import { UpdateTicketStatusUseCase } from "@modules/tickets/useCases/updateTicketStatus/UpdateTicketStatusUseCase";
import { AppError } from "@shared/errors/AppError";
import { ServiceDeskUnavailableError, type IServiceDeskProvider } from "../IServiceDeskProvider";

/**
 * Simulação do sistema legado: "de vez em quando fica indisponível por alguns segundos" (PRD).
 * - janelas de queda: a cada `periodSec` segundos, fica fora por `downSec` segundos;
 * - falhas aleatórias com probabilidade `failureRate`;
 * - latência entre `latencyMs[0]` e `latencyMs[1]`.
 */
export interface ILegacyInstability {
  failureRate: number;
  outage: { periodSec: number; downSec: number } | null;
  latencyMs: [number, number];
}

export interface IRetryPolicy {
  retries: number;
  backoffMs: number;
}

class LegacyTimeout extends Error {}

export class LegacyServiceDeskProvider implements IServiceDeskProvider {
  private list: ListTicketsUseCase;
  private show: ShowTicketUseCase;
  private create: CreateTicketUseCase;
  private comment: AddTicketCommentUseCase;
  private transferUseCase: TransferTicketUseCase;
  private status: UpdateTicketStatusUseCase;
  private search: SearchArticlesUseCase;

  constructor(
    tickets: ITicketsRepository,
    articles: IArticlesRepository,
    users: IUsersRepository,
    private instability: ILegacyInstability,
    private retry: IRetryPolicy = { retries: 3, backoffMs: 400 },
    private random: () => number = Math.random,
    private clock: () => number = Date.now,
  ) {
    this.list = new ListTicketsUseCase(tickets);
    this.show = new ShowTicketUseCase(tickets);
    this.create = new CreateTicketUseCase(tickets);
    this.comment = new AddTicketCommentUseCase(tickets, users);
    this.transferUseCase = new TransferTicketUseCase(tickets);
    this.status = new UpdateTicketStatusUseCase(tickets, users);
    this.search = new SearchArticlesUseCase(articles);
  }

  /** Executa uma operação no "legado", repetindo com backoff exponencial (400 ms, 800 ms, 1,6 s). */
  private async call<T>(operation: () => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try {
        await this.simulateLegacy();
        return await operation();
      } catch (err) {
        if (!(err instanceof LegacyTimeout)) throw err; // erro de negócio: não adianta repetir
        if (attempt >= this.retry.retries) throw new ServiceDeskUnavailableError();
        await sleep(this.retry.backoffMs * 2 ** attempt);
      }
    }
  }

  private async simulateLegacy() {
    const [min, max] = this.instability.latencyMs;
    if (max > 0) await sleep(min + Math.round(this.random() * (max - min)));
    const { outage, failureRate } = this.instability;
    const inOutage = outage !== null && Math.floor(this.clock() / 1000) % outage.periodSec < outage.downSec;
    if (inOutage || this.random() < failureRate) throw new LegacyTimeout();
  }

  listTickets(actor: IActor, scope: "open" | "all", requesterId?: string) {
    return this.call(() => this.list.execute({ actor, scope, requesterId }));
  }

  getTicket(actor: IActor, number: string) {
    return this.call(async () => {
      try {
        return await this.show.execute({ actor, number });
      } catch (err) {
        if (err instanceof AppError && err.statusCode === 404) return null;
        throw err;
      }
    });
  }

  createTicket(actor: IActor, data: ICreateTicketRequest, idempotencyKey: string) {
    return this.call(() => this.create.execute({ actor, data, idempotencyKey }));
  }

  addComment(actor: IActor, number: string, body: string, reopen = false) {
    return this.call(() => this.comment.execute({ actor, number, body, reopen }));
  }

  transfer(actor: IActor, number: string, group: SupportTeam, summary: string) {
    return this.call(() => this.transferUseCase.execute({ actor, number, group, summary }));
  }

  setStatus(actor: IActor, number: string, status: TicketStatus) {
    return this.call(() => this.status.execute({ actor, number, status }));
  }

  searchArticles(query: string) {
    return this.call(() => this.search.execute(query));
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
