import type { Request, Response } from "express";
import { container } from "tsyringe";
import { z } from "zod";
import { RefreshTokenUseCase } from "./RefreshTokenUseCase";
import { LogoutUseCase } from "./LogoutUseCase";

export class RefreshTokenController {
  static body = z.object({ refreshToken: z.string().min(10) });
  static response = z.object({ token: z.string(), refreshToken: z.string() }).meta({ id: "Tokens" });

  async handle(request: Request, response: Response): Promise<Response> {
    const { refreshToken } = RefreshTokenController.body.parse(request.body);
    return response.json(await container.resolve(RefreshTokenUseCase).execute(refreshToken));
  }

  async logout(request: Request, response: Response): Promise<Response> {
    const { refreshToken } = RefreshTokenController.body.parse(request.body);
    await container.resolve(LogoutUseCase).execute(refreshToken);
    return response.status(204).send();
  }
}
