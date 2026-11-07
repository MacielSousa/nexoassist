import { Router } from "express";
import { z } from "zod";
import { TicketResponseSchema } from "@modules/tickets/mapper/TicketMap";
import { AddTicketCommentController } from "@modules/tickets/useCases/addTicketComment/AddTicketCommentController";
import { CreateTicketController } from "@modules/tickets/useCases/createTicket/CreateTicketController";
import { ListTicketsController } from "@modules/tickets/useCases/listTickets/ListTicketsController";
import { SearchArticlesController } from "@modules/tickets/useCases/searchArticles/SearchArticlesController";
import { ArticleResponseSchema } from "@modules/tickets/useCases/searchArticles/SearchArticlesUseCase";
import { ShowTicketController } from "@modules/tickets/useCases/showTicket/ShowTicketController";
import { UpdateTicketStatusController } from "@modules/tickets/useCases/updateTicketStatus/UpdateTicketStatusController";
import { defineRoute } from "../defineRoute";

export const ticketsRoutes = Router();
export const articlesRoutes = Router();

defineRoute(ticketsRoutes, "/tickets", {
  method: "get",
  path: "/",
  tag: "Chamados",
  summary: "Listar chamados",
  description: "Funcionários veem só os próprios. Analistas e admins podem filtrar por solicitante.",
  auth: "any",
  request: { query: ListTicketsController.query },
  responses: { 200: { description: "Chamados", schema: z.array(TicketResponseSchema) } },
  handler: new ListTicketsController().handle,
});

defineRoute(ticketsRoutes, "/tickets", {
  method: "post",
  path: "/",
  tag: "Chamados",
  summary: "Abrir chamado",
  description: "A prioridade é calculada pelas regras do service desk. Envie o header Idempotency-Key para evitar duplicidade em reenvios.",
  auth: ["employee"],
  request: { body: CreateTicketController.body },
  responses: { 201: { description: "Chamado criado", schema: TicketResponseSchema } },
  handler: new CreateTicketController().handle,
});

defineRoute(ticketsRoutes, "/tickets", {
  method: "get",
  path: "/:number",
  tag: "Chamados",
  summary: "Detalhar chamado (com histórico)",
  auth: "any",
  request: { params: ShowTicketController.params },
  responses: { 200: { description: "Chamado", schema: TicketResponseSchema } },
  handler: new ShowTicketController().handle,
});

defineRoute(ticketsRoutes, "/tickets", {
  method: "post",
  path: "/:number/comments",
  tag: "Chamados",
  summary: "Adicionar informação (ou reabrir)",
  auth: "any",
  request: { params: ShowTicketController.params, body: AddTicketCommentController.body },
  responses: { 200: { description: "Chamado atualizado", schema: TicketResponseSchema } },
  handler: new AddTicketCommentController().handle,
});

defineRoute(ticketsRoutes, "/tickets", {
  method: "patch",
  path: "/:number/status",
  tag: "Chamados",
  summary: "Alterar status",
  auth: ["analyst", "admin"],
  request: { params: ShowTicketController.params, body: UpdateTicketStatusController.body },
  responses: { 200: { description: "Chamado atualizado", schema: TicketResponseSchema } },
  handler: new UpdateTicketStatusController().handle,
});

defineRoute(articlesRoutes, "/articles", {
  method: "get",
  path: "/search",
  tag: "Central de ajuda",
  summary: "Buscar artigos por palavras-chave",
  auth: "any",
  request: { query: SearchArticlesController.query },
  responses: { 200: { description: "Artigos mais relevantes", schema: z.array(ArticleResponseSchema) } },
  handler: new SearchArticlesController().handle,
});
