import type { Request, Response } from "express";
import { container } from "tsyringe";
import { z } from "zod";
import { ChangePasswordUseCase } from "../changePassword/ChangePasswordUseCase";
import { UpdateAvatarUseCase } from "../updateAvatar/UpdateAvatarUseCase";
import { UpdateProfileUseCase } from "../updateProfile/UpdateProfileUseCase";
import { ProfileUserUseCase } from "./ProfileUserUseCase";

export class ProfileUserController {
  static changePasswordBody = z.object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8, "A nova senha precisa ter ao menos 8 caracteres").max(72),
  });

  static updateProfileBody = z
    .object({
      name: z.string().trim().min(3).max(120).optional(),
      department: z.string().trim().min(2).max(80).optional(),
      email: z.email().optional().meta({ description: "Exige currentPassword" }),
      currentPassword: z.string().optional(),
    })
    .meta({ id: "UpdateProfile" });

  static userParams = z.object({ id: z.uuid() });

  async show(request: Request, response: Response): Promise<Response> {
    return response.json(await container.resolve(ProfileUserUseCase).execute(request.user.id));
  }

  async update(request: Request, response: Response): Promise<Response> {
    const body = ProfileUserController.updateProfileBody.parse(request.body);
    return response.json(await container.resolve(UpdateProfileUseCase).execute({ userId: request.user.id, ...body }));
  }

  async changePassword(request: Request, response: Response): Promise<Response> {
    const body = ProfileUserController.changePasswordBody.parse(request.body);
    await container.resolve(ChangePasswordUseCase).execute({ userId: request.user.id, ...body });
    return response.status(204).send();
  }

  /** PUT /users/me/avatar e PUT /users/:id/avatar (admin). */
  async updateAvatar(request: Request, response: Response): Promise<Response> {
    const userId = request.params.id ? ProfileUserController.userParams.parse(request.params).id : request.user.id;
    const user = await container.resolve(UpdateAvatarUseCase).update({
      actor: request.user,
      userId,
      originalName: request.file!.originalname,
      content: request.file!.buffer,
    });
    return response.json(user);
  }

  async removeAvatar(request: Request, response: Response): Promise<Response> {
    const userId = request.params.id ? ProfileUserController.userParams.parse(request.params).id : request.user.id;
    return response.json(await container.resolve(UpdateAvatarUseCase).remove({ actor: request.user, userId }));
  }
}
