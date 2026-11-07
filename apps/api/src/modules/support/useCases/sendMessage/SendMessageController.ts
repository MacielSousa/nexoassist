import type { Request, Response } from "express";
import { container } from "tsyringe";
import { z } from "zod";
import { AppError } from "@shared/errors/AppError";
import { openSse } from "@shared/infra/http/sse";
import { SendMessageUseCase } from "./SendMessageUseCase";

export class SendMessageController {
  static body = z.object({ text: z.string().min(1).max(2000).meta({ example: "Meu notebook não conecta na VPN, erro 809" }) });

  /**
   * Responde em streaming (SSE): eventos "user", "steps", "text", "text-reset" e, no fim,
   * "done" com a conversa atualizada (ou "error").
   */
  async handle(request: Request, response: Response): Promise<void> {
    const { text } = SendMessageController.body.parse(request.body);
    const abort = new AbortController();
    const sse = openSse(response);
    response.on("close", () => abort.abort());
    try {
      await container.resolve(SendMessageUseCase).execute({ actor: request.user, text, emit: sse.send, signal: abort.signal });
    } catch (err) {
      if (!(err instanceof AppError)) console.error("[chat]", err);
      sse.send({ type: "error", error: err instanceof AppError ? err.message : "Algo deu errado. Tente de novo." });
    } finally {
      sse.end();
    }
  }
}
