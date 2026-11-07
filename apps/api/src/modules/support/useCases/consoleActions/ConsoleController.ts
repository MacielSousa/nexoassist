import type { Request, Response } from "express";
import { container } from "tsyringe";
import { z } from "zod";
import { ListConsoleConversationsUseCase } from "../listConsoleConversations/ListConsoleConversationsUseCase";
import { ConsoleActionsUseCase } from "./ConsoleActionsUseCase";

export class ConsoleController {
  static params = z.object({ id: z.uuid() });
  static replyBody = z.object({ text: z.string().trim().max(2000).default(""), attachmentIds: z.array(z.uuid()).max(5).default([]) });

  async list(_request: Request, response: Response) {
    return response.json(await container.resolve(ListConsoleConversationsUseCase).execute());
  }

  async take(request: Request, response: Response) {
    const { id } = ConsoleController.params.parse(request.params);
    return response.json(await container.resolve(ConsoleActionsUseCase).takeOver(request.user, id));
  }

  async reply(request: Request, response: Response) {
    const { id } = ConsoleController.params.parse(request.params);
    const { text, attachmentIds } = ConsoleController.replyBody.parse(request.body);
    return response.json(await container.resolve(ConsoleActionsUseCase).reply(request.user, id, text, attachmentIds));
  }

  async returnToAgent(request: Request, response: Response) {
    const { id } = ConsoleController.params.parse(request.params);
    return response.json(await container.resolve(ConsoleActionsUseCase).returnToAgent(request.user, id));
  }

  async close(request: Request, response: Response) {
    const { id } = ConsoleController.params.parse(request.params);
    return response.json(await container.resolve(ConsoleActionsUseCase).close(request.user, id));
  }
}
