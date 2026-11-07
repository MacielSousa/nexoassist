import type { Request, Response } from "express";
import { container } from "tsyringe";
import { z } from "zod";
import { STATUSES } from "@modules/tickets/domain/ticketRules";
import { ShowTicketController } from "../showTicket/ShowTicketController";
import { UpdateTicketStatusUseCase } from "./UpdateTicketStatusUseCase";

export class UpdateTicketStatusController {
  static body = z.object({ status: z.enum(STATUSES) });

  async handle(request: Request, response: Response): Promise<Response> {
    const { number } = ShowTicketController.params.parse(request.params);
    const { status } = UpdateTicketStatusController.body.parse(request.body);
    return response.json(await container.resolve(UpdateTicketStatusUseCase).execute({ actor: request.user, number, status }));
  }
}
