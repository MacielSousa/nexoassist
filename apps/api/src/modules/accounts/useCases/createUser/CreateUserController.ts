import type { Request, Response } from "express";
import { container } from "tsyringe";
import { z } from "zod";
import { SUPPORT_TEAMS, USER_ROLES } from "@modules/accounts/dtos/UserRole";
import { CreateUserUseCase } from "./CreateUserUseCase";

export class CreateUserController {
  static body = z
    .object({
      name: z.string().trim().min(3).max(120).meta({ example: "Marina Alves" }),
      email: z.email().meta({ example: "marina.alves@nexo.com.br" }),
      password: z.string().min(8, "A senha precisa ter ao menos 8 caracteres").max(72),
      role: z.enum(USER_ROLES),
      department: z.string().trim().min(2).max(80).meta({ example: "Financeiro" }),
      team: z.enum(SUPPORT_TEAMS).nullish(),
    })
    .meta({ id: "CreateUser" });

  async handle(request: Request, response: Response): Promise<Response> {
    const body = CreateUserController.body.parse(request.body);
    const user = await container.resolve(CreateUserUseCase).execute(body);
    return response.status(201).json(user);
  }
}
