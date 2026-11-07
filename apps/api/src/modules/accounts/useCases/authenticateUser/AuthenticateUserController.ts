import type { Request, Response } from "express";
import { container } from "tsyringe";
import { z } from "zod";
import { UserResponseSchema } from "@modules/accounts/mapper/UserMap";
import { AuthenticateUserUseCase } from "./AuthenticateUserUseCase";

export class AuthenticateUserController {
  static body = z.object({
    email: z.email().meta({ example: "ana.souza@nexo.com.br" }),
    password: z.string().min(1).meta({ example: "nexo1234" }),
  });

  static response = z
    .object({ token: z.string(), refreshToken: z.string(), user: UserResponseSchema })
    .meta({ id: "Session" });

  async handle(request: Request, response: Response): Promise<Response> {
    const body = AuthenticateUserController.body.parse(request.body);
    const session = await container.resolve(AuthenticateUserUseCase).execute(body);
    return response.json(session);
  }
}
