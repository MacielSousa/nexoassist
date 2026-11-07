import { inject, injectable } from "tsyringe";
import { isOverdue, slaDeadline } from "@modules/tickets/domain/ticketRules";
import type { IAnalystRow, IBreakdown, IConversationStats, IReportFilters } from "@modules/reports/dtos/IReportFilters";
import type { IReportsRepository } from "@modules/reports/repositories/IReportsRepository";

export interface IOverview {
  period: { from: string; to: string };
  tickets: {
    created: number;
    resolved: number;
    stillOpen: number;
    overdue: number;
    /** % dos resolvidos no período que cumpriram o prazo da prioridade. null se nada foi resolvido. */
    slaMetPercent: number | null;
    avgResolutionHours: number | null;
    byPriority: IBreakdown[];
    byCategory: IBreakdown[];
    byStatus: IBreakdown[];
    byType: IBreakdown[];
  };
  conversations: IConversationStats;
  analysts: IAnalystRow[];
  daily: { day: string; created: number; resolved: number }[];
}

/** Visão geral do período: chamados, SLA, conversas (agent × analista) e desempenho por analista. */
@injectable()
export class GetOverviewUseCase {
  constructor(@inject("ReportsRepository") private reports: IReportsRepository) {}

  async execute(filters: IReportFilters): Promise<IOverview> {
    const [byPriority, byCategory, byStatus, byType, resolved, open, conversations, analysts, daily] = await Promise.all([
      this.reports.ticketBreakdown(filters, "priority"),
      this.reports.ticketBreakdown(filters, "category"),
      this.reports.ticketBreakdown(filters, "status"),
      this.reports.ticketBreakdown(filters, "type"),
      this.reports.resolvedTickets(filters),
      this.reports.openTickets(filters),
      this.reports.conversationStats(filters),
      this.reports.analysts(filters),
      this.reports.dailySeries(filters),
    ]);

    // SLA e tempo de solução são calculados com as mesmas regras do domínio de chamados.
    const metSla = resolved.filter((t) => t.resolvedAt <= slaDeadline(t.priority, t.createdAt)).length;
    const totalHours = resolved.reduce((sum, t) => sum + (t.resolvedAt.getTime() - t.createdAt.getTime()) / 3_600_000, 0);
    const now = new Date();

    return {
      period: { from: filters.from.toISOString(), to: filters.to.toISOString() },
      tickets: {
        created: byPriority.reduce((sum, b) => sum + b.count, 0),
        resolved: resolved.length,
        stillOpen: open.length,
        overdue: open.filter((t) => isOverdue(t, now)).length,
        slaMetPercent: resolved.length ? Math.round((metSla / resolved.length) * 100) : null,
        avgResolutionHours: resolved.length ? Math.round((totalHours / resolved.length) * 10) / 10 : null,
        byPriority,
        byCategory,
        byStatus,
        byType,
      },
      conversations,
      analysts,
      daily,
    };
  }
}
