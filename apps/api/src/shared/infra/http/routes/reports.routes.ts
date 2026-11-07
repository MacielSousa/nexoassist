import { Router } from "express";
import { z } from "zod";
import { ReportsController } from "@modules/reports/useCases/getOverview/ReportsController";
import { defineRoute } from "../defineRoute";

export const reportsRoutes = Router();
const reports = new ReportsController();

defineRoute(reportsRoutes, "/reports", {
  method: "get",
  path: "/overview",
  tag: "Relatórios",
  summary: "Visão geral do período",
  description: "Chamados (criados, resolvidos, vencidos, SLA, por prioridade/categoria/status/tipo), conversas (resolvidas pelo agent × transferidas) e desempenho por analista.",
  auth: ["admin", "analyst"],
  request: { query: ReportsController.filters },
  responses: { 200: { description: "Indicadores do período", schema: z.record(z.string(), z.any()) } },
  handler: reports.overview,
});

defineRoute(reportsRoutes, "/reports", {
  method: "get",
  path: "/tickets",
  tag: "Relatórios",
  summary: "Chamados do período (paginado)",
  auth: ["admin", "analyst"],
  request: { query: ReportsController.listQuery },
  responses: { 200: { description: "Página de chamados", schema: z.record(z.string(), z.any()) } },
  handler: reports.tickets,
});

defineRoute(reportsRoutes, "/reports", {
  method: "get",
  path: "/tickets.csv",
  tag: "Relatórios",
  summary: "Exportar chamados do período em CSV",
  auth: ["admin", "analyst"],
  request: { query: ReportsController.filters },
  responses: { 200: { description: "Arquivo CSV (UTF-8, separador ;)", schema: z.string(), contentType: "text/csv" } },
  handler: reports.ticketsCsv,
});
