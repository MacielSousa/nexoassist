import type { Request, Response } from "express";
import { container } from "tsyringe";
import { z } from "zod";
import { ShowTicketController } from "../showTicket/ShowTicketController";
import { AddTicketCommentUseCase } from "./AddTicketCommentUseCase";

export class AddTicketCommentController {
  static body = z.object({
    body: z.string().trim().min(3).max(2000),
    reopen: z.boolean().optional().meta({ description: "Reabre se o chamado foi resolvido há até 7 dias" }),
  });

  async handle(request: Request, response: Response): Promise<Response> {
    const { number } = ShowTicketController.params.parse(request.params);
    const body = AddTicketCommentController.body.parse(request.body);
    return response.json(await container.resolve(AddTicketCommentUseCase).execute({ actor: request.user, number, ...body }));
  }
}
