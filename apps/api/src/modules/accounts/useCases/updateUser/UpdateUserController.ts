import type { Request, Response } from "express";
import { container } from "tsyringe";
import { z } from "zod";
import { PERMISSION_KEYS } from "@modules/accounts/dtos/permissions";
import { SUPPORT_TEAMS } from "@modules/accounts/dtos/UserRole";
import { SetUserPermissionsUseCase } from "../setUserPermissions/SetUserPermissionsUseCase";
import { UpdateUserUseCase } from "./UpdateUserUseCase";

export class UpdateUserController {
  static params = z.object({ id: z.uuid() });
  static body = z
    .object({
      name: z.string().trim().min(3).max(120),
      roleId: z.uuid(),
      department: z.string().trim().min(2).max(80),
      team: z.enum(SUPPORT_TEAMS).nullable(),
      active: z.boolean(),
      password: z.string().min(8).max(72).meta({ description: "Nova senha (redefinição administrativa)" }),
    })
    .partial()
    .meta({ id: "UpdateUser" });
  static permissionsBody = z
    .object({ permissions: z.array(z.enum(PERMISSION_KEYS)).meta({ description: "Permissões extras (além das da role). Substitui a lista atual." }) })
    .meta({ id: "SetUserPermissions" });

  async handle(request: Request, response: Response): Promise<Response> {
    const { id } = UpdateUserController.params.parse(request.params);
    const body = UpdateUserController.body.parse(request.body);
    return response.json(await container.resolve(UpdateUserUseCase).execute({ id, actor: request.user, ...body }));
  }

  async setPermissions(request: Request, response: Response): Promise<Response> {
    const { id } = UpdateUserController.params.parse(request.params);
    const { permissions } = UpdateUserController.permissionsBody.parse(request.body);
    return response.json(await container.resolve(SetUserPermissionsUseCase).execute({ actor: request.user, userId: id, permissions }));
  }
}
