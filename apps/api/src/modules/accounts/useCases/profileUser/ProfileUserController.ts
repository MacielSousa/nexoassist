import type { Request, Response } from "express";
import { container } from "tsyringe";
import { z } from "zod";
import { ChangePasswordUseCase } from "../changePassword/ChangePasswordUseCase";
import { ProfileUserUseCase } from "./ProfileUserUseCase";

export class ProfileUserController {
  static changePasswordBody = z.object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8, "A nova senha precisa ter ao menos 8 caracteres").max(72),
  });

  async show(request: Request, response: Response): Promise<Response> {
    return response.json(await container.resolve(ProfileUserUseCase).execute(request.user.id));
  }

  async changePassword(request: Request, response: Response): Promise<Response> {
    const body = ProfileUserController.changePasswordBody.parse(request.body);
    await container.resolve(ChangePasswordUseCase).execute({ userId: request.user.id, ...body });
    return response.status(204).send();
  }
}
