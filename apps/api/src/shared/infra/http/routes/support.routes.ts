import { Router } from "express";
import { z } from "zod";
import { SnapshotResponseSchema } from "@modules/support/mapper/ConversationMap";
import { ConsoleController } from "@modules/support/useCases/consoleActions/ConsoleController";
import { ConversationsController } from "@modules/support/useCases/getActiveConversation/ConversationsController";
import { ConsoleItemSchema } from "@modules/support/useCases/listConsoleConversations/ListConsoleConversationsUseCase";
import { SendMessageController } from "@modules/support/useCases/sendMessage/SendMessageController";
import { FileResponseSchema } from "@modules/files/mapper/FileMap";
import { FilesController } from "@modules/files/useCases/FilesController";
import { defineRoute } from "../defineRoute";
import { uploadSingleFile } from "../middlewares/uploadSingleFile";

export const conversationsRoutes = Router();
export const draftsRoutes = Router();
export const consoleRoutes = Router();

const conversations = new ConversationsController();
const consoleController = new ConsoleController();
const snapshot = { description: "Conversa com mensagens e rascunhos", schema: SnapshotResponseSchema };
const sseResponse = { description: "Stream de eventos (text/event-stream)", schema: z.string(), contentType: "text/event-stream" };

// ---- Chat do funcionário ----

defineRoute(conversationsRoutes, "/conversations", {
  method: "get",
  path: "/active",
  tag: "Atendimento",
  summary: "Conversa em andamento do funcionário (cria se não houver)",
  auth: ["employee"],
  responses: { 200: snapshot },
  handler: conversations.active,
});

defineRoute(conversationsRoutes, "/conversations", {
  method: "post",
  path: "/",
  tag: "Atendimento",
  summary: "Começar uma nova conversa",
  description: "Encerra a atual, se estiver só com o agent.",
  auth: ["employee"],
  responses: { 201: snapshot },
  handler: conversations.startNew,
});

defineRoute(conversationsRoutes, "/conversations", {
  method: "post",
  path: "/active/messages",
  tag: "Atendimento",
  summary: "Enviar mensagem e receber a resposta do agent em streaming",
  description:
    'Resposta SSE com eventos JSON: `user` (mensagem salva), `steps` (ações do agent), `text` / `text-reset` (texto em streaming), `done` (conversa atualizada) ou `error`.',
  auth: ["employee"],
  request: { body: SendMessageController.body },
  responses: { 200: sseResponse },
  handler: new SendMessageController().handle,
});

defineRoute(conversationsRoutes, "/conversations", {
  method: "get",
  path: "/:id",
  tag: "Atendimento",
  summary: "Detalhar uma conversa",
  description: "O funcionário vê só a própria; analistas e admins veem todas.",
  auth: "any",
  request: { params: ConversationsController.idParams },
  responses: { 200: snapshot },
  handler: conversations.show,
});

defineRoute(conversationsRoutes, "/conversations", {
  method: "get",
  path: "/:id/events",
  tag: "Atendimento",
  summary: "Tempo real da conversa (SSE)",
  description: "Envia `update` com mensagens novas e o estado a cada mudança (analista assumiu, respondeu, transferência...).",
  auth: "any",
  request: { params: ConversationsController.idParams, query: ConversationsController.eventsQuery },
  responses: { 200: sseResponse },
  handler: conversations.events,
});

defineRoute(conversationsRoutes, "/conversations", {
  method: "post",
  path: "/:id/attachments",
  tag: "Atendimento",
  summary: "Enviar anexo (imagem, vídeo ou documento) para a conversa",
  description: "Devolve o id do arquivo; envie-o em attachmentIds ao mandar a mensagem. Imagem até 5 MB, vídeo até 25 MB, documento até 10 MB.",
  auth: "any",
  request: { params: FilesController.conversationParams, body: FilesController.uploadBody },
  bodyContentType: "multipart/form-data",
  middlewares: [uploadSingleFile],
  responses: { 201: { description: "Arquivo salvo", schema: FileResponseSchema } },
  handler: new FilesController().uploadAttachment,
});

defineRoute(draftsRoutes, "/drafts", {
  method: "post",
  path: "/:id/confirm",
  tag: "Atendimento",
  summary: "Confirmar rascunho (cria ou atualiza o chamado)",
  description: "Determinístico, sem LLM. Idempotente: confirmar duas vezes não duplica o chamado.",
  auth: ["employee"],
  request: { params: ConversationsController.draftParams },
  responses: { 200: snapshot },
  handler: conversations.confirmDraft,
});

defineRoute(draftsRoutes, "/drafts", {
  method: "post",
  path: "/:id/cancel",
  tag: "Atendimento",
  summary: "Cancelar rascunho",
  auth: ["employee"],
  request: { params: ConversationsController.draftParams },
  responses: { 200: snapshot },
  handler: conversations.cancelDraft,
});

// ---- Console do analista ----

defineRoute(consoleRoutes, "/console", {
  method: "get",
  path: "/conversations",
  tag: "Console",
  summary: "Conversas para o console",
  auth: ["analyst", "admin"],
  responses: { 200: { description: "Conversas em andamento e encerradas nos últimos 3 dias", schema: z.array(ConsoleItemSchema) } },
  handler: consoleController.list,
});

const action = (path: string, summary: string, handler: ConsoleController[keyof ConsoleController], body?: typeof ConsoleController.replyBody) =>
  defineRoute(consoleRoutes, "/console", {
    method: "post",
    path: `/conversations/:id/${path}`,
    tag: "Console",
    summary,
    auth: ["analyst", "admin"],
    request: { params: ConsoleController.params, body },
    responses: { 200: snapshot },
    handler,
  });

action("take", "Assumir atendimento (pausa o agent)", consoleController.take);
action("messages", "Responder ao funcionário", consoleController.reply, ConsoleController.replyBody);
action("return", "Devolver ao agent", consoleController.returnToAgent);
action("close", "Encerrar atendimento", consoleController.close);
