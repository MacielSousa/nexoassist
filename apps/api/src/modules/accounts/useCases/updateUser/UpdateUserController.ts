import type { Request, Response } from "express";
import { container } from "tsyringe";
import { z } from "zod";
import { SUPPORT_TEAMS, USER_ROLES } from "@modules/accounts/dtos/UserRole";
import { UpdateUserUseCase } from "./UpdateUserUseCase";

export class UpdateUserController {
  static params = z.object({ id: z.uuid() });
  static body = z
    .object({
      name: z.string().trim().min(3).max(120),
      role: z.enum(USER_ROLES),
      department: z.string().trim().min(2).max(80),
      team: z.enum(SUPPORT_TEAMS).nullable(),
      active: z.boolean(),
      password: z.string().min(8).max(72).meta({ description: "Nova senha (redefinição pelo admin)" }),
    })
    .partial()
    .meta({ id: "UpdateUser" });

  async handle(request: Request, response: Response): Promise<Response> {
    const { id } = UpdateUserController.params.parse(request.params);
    const body = UpdateUserController.body.parse(request.body);
    return response.json(await container.resolve(UpdateUserUseCase).execute({ id, actorId: request.user.id, ...body }));
  }
}
