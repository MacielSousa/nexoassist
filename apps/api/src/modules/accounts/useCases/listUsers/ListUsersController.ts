import type { Request, Response } from "express";
import { container } from "tsyringe";
import { z } from "zod";
import { USER_ROLES } from "@modules/accounts/dtos/UserRole";
import { ListUsersUseCase } from "./ListUsersUseCase";

export class ListUsersController {
  static query = z.object({
    role: z.enum(USER_ROLES).optional(),
    search: z.string().trim().max(80).optional(),
    active: z.enum(["true", "false"]).transform((v) => v === "true").optional(),
  });

  async handle(request: Request, response: Response): Promise<Response> {
    const filter = ListUsersController.query.parse(request.query);
    return response.json(await container.resolve(ListUsersUseCase).execute(filter));
  }
}
