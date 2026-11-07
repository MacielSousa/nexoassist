import type { Request, Response } from "express";
import { container } from "tsyringe";
import { z } from "zod";
import { ShowTicketUseCase } from "./ShowTicketUseCase";

export class ShowTicketController {
  static params = z.object({ number: z.string().regex(/^(INC|REQ)-\d+$/i).meta({ example: "INC-20311" }) });

  async handle(request: Request, response: Response): Promise<Response> {
    const { number } = ShowTicketController.params.parse(request.params);
    return response.json(await container.resolve(ShowTicketUseCase).execute({ actor: request.user, number }));
  }
}
