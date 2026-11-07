import type { Request, Response } from "express";
import { container } from "tsyringe";
import { z } from "zod";
import { ListTicketsUseCase } from "./ListTicketsUseCase";

export class ListTicketsController {
  static query = z.object({
    scope: z.enum(["open", "all"]).default("open"),
    requesterId: z.uuid().optional().meta({ description: "Só analistas e admins" }),
    search: z.string().trim().max(80).optional(),
  });

  async handle(request: Request, response: Response): Promise<Response> {
    const query = ListTicketsController.query.parse(request.query);
    return response.json(await container.resolve(ListTicketsUseCase).execute({ actor: request.user, ...query }));
  }
}
