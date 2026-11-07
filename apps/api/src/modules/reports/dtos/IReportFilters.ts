import type { SupportTeam } from "@modules/accounts/dtos/UserRole";
import type { Category, Priority, TicketStatus, TicketType } from "@modules/tickets/domain/ticketRules";

/** Filtros comuns a todos os relatórios. Datas já convertidas para instantes (início e fim do dia em Brasília). */
export interface IReportFilters {
  from: Date;
  to: Date;
  analystId?: string;
  team?: SupportTeam;
  category?: Category;
  priority?: Priority;
  type?: TicketType;
  status?: TicketStatus;
}

export interface IBreakdown {
  key: string;
  count: number;
}

export interface IReportTicketRow {
  number: string;
  type: TicketType;
  title: string;
  category: Category;
  priority: Priority;
  status: TicketStatus;
  requesterName: string;
  assignedGroup: string | null;
  resolvedByName: string | null;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt: Date | null;
}

export interface IAnalystRow {
  id: string;
  name: string;
  team: SupportTeam | null;
  conversationsTaken: number;
  conversationsClosed: number;
  avgTakeoverMinutes: number | null;
  ticketsResolved: number;
}

export interface IConversationStats {
  total: number;
  resolvedByAgent: number;
  transferred: number;
  takenOver: number;
  avgTakeoverMinutes: number | null;
  byHandoffReason: IBreakdown[];
}
