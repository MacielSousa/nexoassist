import { inject, injectable } from "tsyringe";
import { UserMap, type IUserResponseDTO } from "@modules/accounts/mapper/UserMap";
import type { IUsersRepository } from "@modules/accounts/repositories/IUsersRepository";
import { AppError } from "@shared/errors/AppError";

@injectable()
export class ProfileUserUseCase {
  constructor(@inject("UsersRepository") private usersRepository: IUsersRepository) {}

  async execute(id: string): Promise<IUserResponseDTO> {
    const user = await this.usersRepository.findById(id);
    if (!user || !user.active) throw new AppError("Usuário não encontrado.", 404);
    return UserMap.toDTO(user);
  }
}
