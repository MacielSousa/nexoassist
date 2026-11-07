import { Router } from "express";
import { z } from "zod";
import { FilesController } from "@modules/files/useCases/FilesController";
import { defineRoute } from "../defineRoute";

export const filesRoutes = Router();

defineRoute(filesRoutes, "/files", {
  method: "get",
  path: "/:id",
  tag: "Arquivos",
  summary: "Baixar um arquivo (foto de perfil ou anexo)",
  description: "Anexos só podem ser baixados por quem participa da conversa.",
  auth: "any",
  request: { params: FilesController.idParams },
  responses: { 200: { description: "Conteúdo do arquivo", schema: z.string(), contentType: "application/octet-stream" } },
  handler: new FilesController().download,
});
