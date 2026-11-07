import type { Request, Response } from "express";
import { container } from "tsyringe";
import { z } from "zod";
import { SUPPORT_TEAMS } from "@modules/accounts/dtos/UserRole";
import type { IReportFilters } from "@modules/reports/dtos/IReportFilters";
import type { IReportsRepository } from "@modules/reports/repositories/IReportsRepository";
import { CATEGORIES, PRIORITIES, STATUS_LABEL, STATUSES, TICKET_TYPES } from "@modules/tickets/domain/ticketRules";
import { AppError } from "@shared/errors/AppError";
import { GetOverviewUseCase } from "./GetOverviewUseCase";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use o formato AAAA-MM-DD");

/** Converte um dia (AAAA-MM-DD) no início ou fim desse dia em Brasília (UTC-3). */
const brtStart = (d: string) => new Date(`${d}T00:00:00-03:00`);
const brtEnd = (d: string) => new Date(`${d}T23:59:59.999-03:00`);

export class ReportsController {
  static filters = z
    .object({
      from: day.optional().meta({ description: "Início (padrão: 30 dias atrás)", example: "2026-10-01" }),
      to: day.optional().meta({ description: "Fim (padrão: hoje)", example: "2026-11-07" }),
      analystId: z.uuid().optional(),
      team: z.enum(SUPPORT_TEAMS).optional(),
      category: z.enum(CATEGORIES).optional(),
      priority: z.enum(PRIORITIES).optional(),
      type: z.enum(TICKET_TYPES).optional(),
      status: z.enum(STATUSES).optional(),
    })
    .meta({ id: "ReportFilters" });

  static listQuery = ReportsController.filters.extend({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  });

  static parseFilters(query: unknown): IReportFilters {
    const { from, to, ...rest } = ReportsController.filters.parse(query);
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
    const end = brtEnd(to ?? today);
    const start = from ? brtStart(from) : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000 + 1);
    if (start > end) throw new AppError("A data inicial precisa ser anterior à final.", 422);
    if (end.getTime() - start.getTime() > 366 * 24 * 60 * 60 * 1000) throw new AppError("O período máximo é de 1 ano.", 422);
    return { ...rest, from: start, to: end };
  }

  async overview(request: Request, response: Response) {
    const filters = ReportsController.parseFilters(request.query);
    return response.json(await container.resolve(GetOverviewUseCase).execute(filters));
  }

  async tickets(request: Request, response: Response) {
    const { page, pageSize } = ReportsController.listQuery.parse(request.query);
    const filters = ReportsController.parseFilters(request.query);
    const reports = container.resolve<IReportsRepository>("ReportsRepository");
    return response.json({ page, pageSize, ...(await reports.listTickets(filters, page, pageSize)) });
  }

  /** Mesma lista em CSV (até 5.000 linhas), pronta para abrir no Excel. */
  async ticketsCsv(request: Request, response: Response) {
    const filters = ReportsController.parseFilters(request.query);
    const { rows } = await container.resolve<IReportsRepository>("ReportsRepository").listTickets(filters, 1, 5000);
    const fmt = (d: Date | null) => (d ? new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).format(d) : "");
    // Aspas duplicadas e prefixo contra injeção de fórmula (=, +, -, @) ao abrir no Excel.
    const cell = (v: string) => `"${(/^[=+\-@]/.test(v) ? `'${v}` : v).replace(/"/g, '""')}"`;
    const header = ["Chamado", "Tipo", "Título", "Categoria", "Prioridade", "Status", "Solicitante", "Fila", "Resolvido por", "Aberto em", "Atualizado em", "Resolvido em"];
    const lines = rows.map((r) =>
      [r.number, r.type, r.title, r.category, r.priority, STATUS_LABEL[r.status], r.requesterName, r.assignedGroup ?? "", r.resolvedByName ?? "", fmt(r.createdAt), fmt(r.updatedAt), fmt(r.resolvedAt)]
        .map((v) => cell(String(v)))
        .join(";"),
    );
    response.setHeader("Content-Type", "text/csv; charset=utf-8");
    response.setHeader("Content-Disposition", `attachment; filename="chamados.csv"`);
    // BOM para o Excel reconhecer UTF-8 (acentos); ";" é o separador padrão no Excel em português.
    response.send("﻿" + [header.map(cell).join(";"), ...lines].join("\r\n"));
  }
}
