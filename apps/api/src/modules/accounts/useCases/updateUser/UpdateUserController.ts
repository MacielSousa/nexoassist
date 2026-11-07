import type { Request, Response } from "express";
import { container } from "tsyringe";
import { z } from "zod";
import { PERMISSION_KEYS } from "@modules/accounts/dtos/permissions";
import { SUPPORT_TEAMS } from "@modules/accounts/dtos/UserRole";
import { SetUserAccessUseCase } from "../setUserAccess/SetUserAccessUseCase";
import { UpdateUserUseCase } from "./UpdateUserUseCase";

export class UpdateUserController {
  static params = z.object({ id: z.uuid() });
  static body = z
    .object({
      name: z.string().trim().min(3).max(120),
      department: z.string().trim().min(2).max(80),
      team: z.enum(SUPPORT_TEAMS).nullable(),
      active: z.boolean(),
      password: z.string().min(8).max(72).meta({ description: "Nova senha (redefinição administrativa)" }),
    })
    .partial()
    .meta({ id: "UpdateUser" });
  static accessBody = z
    .object({
      roleIds: z.array(z.uuid()).max(20).meta({ description: "Roles do usuário (macro). Substitui a lista atual." }),
      permissions: z.array(z.enum(PERMISSION_KEYS)).meta({ description: "Permissões concedidas direto (micro), além das roles. Substitui a lista atual." }),
      team: z.enum(SUPPORT_TEAMS).nullish().meta({ description: "Fila; obrigatória se o acesso inclui console.attend. Omitida mantém a atual." }),
    })
    .meta({ id: "SetUserAccess" });

  async handle(request: Request, response: Response): Promise<Response> {
    const { id } = UpdateUserController.params.parse(request.params);
    const body = UpdateUserController.body.parse(request.body);
    return response.json(await container.resolve(UpdateUserUseCase).execute({ id, actor: request.user, ...body }));
  }

  async setAccess(request: Request, response: Response): Promise<Response> {
    const { id } = UpdateUserController.params.parse(request.params);
    const { team, ...body } = UpdateUserController.accessBody.parse(request.body);
    return response.json(await container.resolve(SetUserAccessUseCase).execute({ actor: request.user, userId: id, ...body, team: team === undefined ? undefined : team }));
  }
}
