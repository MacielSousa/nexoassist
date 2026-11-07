import type { Request, Response } from "express";
import { container } from "tsyringe";
import { z } from "zod";
import { PERMISSION_KEYS } from "@modules/accounts/dtos/permissions";
import { RolesUseCases } from "./RolesUseCases";

export class RolesController {
  static params = z.object({ id: z.uuid() });
  static body = z
    .object({
      name: z.string().trim().min(3).max(60).meta({ example: "Suporte N3" }),
      description: z.string().trim().max(200).default(""),
      permissions: z.array(z.enum(PERMISSION_KEYS)),
    })
    .meta({ id: "SaveRole" });
  static updateBody = RolesController.body.partial().meta({ id: "UpdateRole" });

  async list(_request: Request, response: Response) {
    return response.json(await container.resolve(RolesUseCases).list());
  }

  async permissions(_request: Request, response: Response) {
    return response.json(await container.resolve(RolesUseCases).listPermissions());
  }

  async create(request: Request, response: Response) {
    const body = RolesController.body.parse(request.body);
    return response.status(201).json(await container.resolve(RolesUseCases).create({ actor: request.user, ...body }));
  }

  async update(request: Request, response: Response) {
    const { id } = RolesController.params.parse(request.params);
    const body = RolesController.updateBody.parse(request.body);
    return response.json(await container.resolve(RolesUseCases).update({ actor: request.user, id, ...body }));
  }

  async delete(request: Request, response: Response) {
    const { id } = RolesController.params.parse(request.params);
    await container.resolve(RolesUseCases).delete(id);
    return response.status(204).send();
  }
}
