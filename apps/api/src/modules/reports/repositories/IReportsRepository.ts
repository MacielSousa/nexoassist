import type { Priority, TicketStatus } from "@modules/tickets/domain/ticketRules";
import type { IAnalystRow, IBreakdown, IConversationStats, IReportFilters, IReportTicketRow } from "../dtos/IReportFilters";

/** Consultas agregadas para os relatórios (somente leitura). */
export interface IReportsRepository {
  /** Chamados criados no período, agrupados por um campo. */
  ticketBreakdown(filters: IReportFilters, field: "priority" | "category" | "status" | "type"): Promise<IBreakdown[]>;
  /** Chamados resolvidos/fechados no período, com o necessário para calcular SLA e tempo de solução. */
  resolvedTickets(filters: IReportFilters): Promise<{ priority: Priority; createdAt: Date; resolvedAt: Date }[]>;
  /** Chamados criados no período que continuam abertos, para calcular os vencidos. */
  openTickets(filters: IReportFilters): Promise<{ priority: Priority; status: TicketStatus; updatedAt: Date }[]>;
  /** Série diária (dia no fuso de Brasília): criados e resolvidos. */
  dailySeries(filters: IReportFilters): Promise<{ day: string; created: number; resolved: number }[]>;
  conversationStats(filters: IReportFilters): Promise<IConversationStats>;
  analysts(filters: IReportFilters): Promise<IAnalystRow[]>;
  listTickets(filters: IReportFilters, page: number, pageSize: number): Promise<{ rows: IReportTicketRow[]; total: number }>;
}
