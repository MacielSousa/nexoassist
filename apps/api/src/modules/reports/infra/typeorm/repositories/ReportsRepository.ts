import type { Priority, TicketStatus } from "@modules/tickets/domain/ticketRules";
import type { IAnalystRow, IBreakdown, IConversationStats, IReportFilters, IReportTicketRow } from "@modules/reports/dtos/IReportFilters";
import type { IReportsRepository } from "@modules/reports/repositories/IReportsRepository";
import { AppDataSource } from "@shared/infra/typeorm/data-source";

/**
 * Relatórios em SQL puro: agregações ficam mais claras (e rápidas) assim do que pelo ORM.
 * Todos os valores entram por parâmetro ($1, $2...), nunca concatenados.
 */

/** Monta o WHERE dos filtros de chamado. `dateColumn` define qual data cai no período. */
function ticketWhere(f: IReportFilters, dateColumn: "t.created_at" | "t.resolved_at") {
  const params: unknown[] = [f.from, f.to];
  const where = [`${dateColumn} BETWEEN $1 AND $2`];
  const add = (sql: string, value: unknown) => {
    params.push(value);
    where.push(sql.replace("?", `$${params.length}`));
  };
  if (f.category) add("t.category = ?", f.category);
  if (f.priority) add("t.priority = ?", f.priority);
  if (f.type) add("t.type = ?", f.type);
  if (f.status) add("t.status = ?", f.status);
  if (f.team) add("t.assigned_group = ?", f.team);
  if (f.analystId) {
    // Chamados que o analista assumiu ou resolveu (o mesmo parâmetro nas duas colunas).
    params.push(f.analystId);
    const i = params.length;
    where.push(`(t.resolved_by_id = $${i} OR t.assigned_analyst_id = $${i})`);
  }
  return { sql: where.join(" AND "), params };
}

const BRT = "America/Sao_Paulo";
const OPEN = `('aberto', 'em_andamento', 'aguardando_analista', 'aguardando_funcionario', 'aprovado')`;

export class ReportsRepository implements IReportsRepository {
  async ticketBreakdown(f: IReportFilters, field: "priority" | "category" | "status" | "type"): Promise<IBreakdown[]> {
    const { sql, params } = ticketWhere(f, "t.created_at");
    const rows = (await AppDataSource.query(
      `SELECT t.${field} AS key, COUNT(*)::int AS count FROM tickets t WHERE ${sql} GROUP BY t.${field} ORDER BY count DESC`,
      params,
    )) as IBreakdown[];
    return rows;
  }

  async resolvedTickets(f: IReportFilters) {
    const { sql, params } = ticketWhere(f, "t.resolved_at");
    return (await AppDataSource.query(
      `SELECT t.priority, t.created_at AS "createdAt", t.resolved_at AS "resolvedAt" FROM tickets t WHERE ${sql}`,
      params,
    )) as { priority: Priority; createdAt: Date; resolvedAt: Date }[];
  }

  async openTickets(f: IReportFilters) {
    const { sql, params } = ticketWhere(f, "t.created_at");
    return (await AppDataSource.query(
      `SELECT t.priority, t.status, t.updated_at AS "updatedAt" FROM tickets t WHERE ${sql} AND t.status IN ${OPEN}`,
      params,
    )) as { priority: Priority; status: TicketStatus; updatedAt: Date }[];
  }

  async dailySeries(f: IReportFilters) {
    const created = ticketWhere(f, "t.created_at");
    const resolved = ticketWhere(f, "t.resolved_at");
    const [a, b] = await Promise.all([
      AppDataSource.query(
        `SELECT to_char(t.created_at AT TIME ZONE '${BRT}', 'YYYY-MM-DD') AS day, COUNT(*)::int AS n FROM tickets t WHERE ${created.sql} GROUP BY day`,
        created.params,
      ) as Promise<{ day: string; n: number }[]>,
      AppDataSource.query(
        `SELECT to_char(t.resolved_at AT TIME ZONE '${BRT}', 'YYYY-MM-DD') AS day, COUNT(*)::int AS n FROM tickets t WHERE ${resolved.sql} GROUP BY day`,
        resolved.params,
      ) as Promise<{ day: string; n: number }[]>,
    ]);
    const days = new Map<string, { day: string; created: number; resolved: number }>();
    for (const r of a) days.set(r.day, { day: r.day, created: r.n, resolved: 0 });
    for (const r of b) days.set(r.day, { ...(days.get(r.day) ?? { day: r.day, created: 0 }), resolved: r.n });
    return [...days.values()].sort((x, y) => x.day.localeCompare(y.day));
  }

  async conversationStats(f: IReportFilters): Promise<IConversationStats> {
    const params: unknown[] = [f.from, f.to];
    const where = ["c.created_at BETWEEN $1 AND $2"];
    if (f.analystId) {
      params.push(f.analystId);
      where.push(`c.handled_by_id = $${params.length}`);
    }
    if (f.team) {
      params.push(f.team);
      where.push(`c.handoff_group = $${params.length}`);
    }
    const sql = where.join(" AND ");
    const [row] = (await AppDataSource.query(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE c.status = 'closed' AND c.handoff_at IS NULL)::int AS "resolvedByAgent",
              COUNT(*) FILTER (WHERE c.handoff_at IS NOT NULL)::int AS transferred,
              COUNT(*) FILTER (WHERE c.taken_at IS NOT NULL)::int AS "takenOver",
              ROUND(AVG(EXTRACT(EPOCH FROM (c.taken_at - c.handoff_at)) / 60) FILTER (WHERE c.taken_at > c.handoff_at))::int AS "avgTakeoverMinutes"
       FROM conversations c WHERE ${sql}`,
      params,
    )) as Omit<IConversationStats, "byHandoffReason">[];
    const byHandoffReason = (await AppDataSource.query(
      `SELECT c.handoff_reason AS key, COUNT(*)::int AS count FROM conversations c
       WHERE ${sql} AND c.handoff_reason IS NOT NULL GROUP BY c.handoff_reason ORDER BY count DESC`,
      params,
    )) as IBreakdown[];
    return { ...row!, byHandoffReason };
  }

  async analysts(f: IReportFilters): Promise<IAnalystRow[]> {
    const params: unknown[] = [f.from, f.to];
    const where = ["u.role = 'analyst'"];
    if (f.analystId) {
      params.push(f.analystId);
      where.push(`u.id = $${params.length}`);
    }
    if (f.team) {
      params.push(f.team);
      where.push(`u.team = $${params.length}`);
    }
    return (await AppDataSource.query(
      `SELECT u.id, u.name, u.team,
         (SELECT COUNT(*) FROM conversations c WHERE c.handled_by_id = u.id AND c.taken_at BETWEEN $1 AND $2)::int AS "conversationsTaken",
         (SELECT COUNT(*) FROM conversations c WHERE c.closed_by_id = u.id AND c.closed_at BETWEEN $1 AND $2)::int AS "conversationsClosed",
         (SELECT ROUND(AVG(EXTRACT(EPOCH FROM (c.taken_at - c.handoff_at)) / 60))::int FROM conversations c
            WHERE c.handled_by_id = u.id AND c.taken_at BETWEEN $1 AND $2 AND c.taken_at > c.handoff_at) AS "avgTakeoverMinutes",
         (SELECT COUNT(*) FROM tickets t WHERE t.resolved_by_id = u.id AND t.resolved_at BETWEEN $1 AND $2)::int AS "ticketsResolved"
       FROM users u WHERE ${where.join(" AND ")} ORDER BY u.name`,
      params,
    )) as IAnalystRow[];
  }

  async listTickets(f: IReportFilters, page: number, pageSize: number) {
    const { sql, params } = ticketWhere(f, "t.created_at");
    const [count] = (await AppDataSource.query(`SELECT COUNT(*)::int AS total FROM tickets t WHERE ${sql}`, params)) as { total: number }[];
    const rows = (await AppDataSource.query(
      `SELECT t.number, t.type, t.title, t.category, t.priority, t.status, r.name AS "requesterName", t.assigned_group AS "assignedGroup",
              rb.name AS "resolvedByName", t.created_at AS "createdAt", t.updated_at AS "updatedAt", t.resolved_at AS "resolvedAt"
       FROM tickets t
       JOIN users r ON r.id = t.requester_id
       LEFT JOIN users rb ON rb.id = t.resolved_by_id
       WHERE ${sql}
       ORDER BY t.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, pageSize, (page - 1) * pageSize],
    )) as IReportTicketRow[];
    return { rows, total: count!.total };
  }
}
