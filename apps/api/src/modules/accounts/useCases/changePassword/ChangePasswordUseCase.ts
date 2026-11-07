import { inject, injectable } from "tsyringe";
import type { IUsersRepository } from "@modules/accounts/repositories/IUsersRepository";
import type { IUsersTokensRepository } from "@modules/accounts/repositories/IUsersTokensRepository";
import type { IHashProvider } from "@shared/container/providers/HashProvider/IHashProvider";
import { AppError } from "@shared/errors/AppError";

interface IRequest {
  userId: string;
  currentPassword: string;
  newPassword: string;
}

@injectable()
export class ChangePasswordUseCase {
  constructor(
    @inject("UsersRepository") private usersRepository: IUsersRepository,
    @inject("UsersTokensRepository") private usersTokensRepository: IUsersTokensRepository,
    @inject("HashProvider") private hashProvider: IHashProvider,
  ) {}

  async execute({ userId, currentPassword, newPassword }: IRequest): Promise<void> {
    const user = await this.usersRepository.findById(userId);
    if (!user) throw new AppError("Usuário não encontrado.", 404);
    if (!(await this.hashProvider.compareHash(currentPassword, user.password))) {
      throw new AppError("Senha atual incorreta.", 400);
    }
    await this.usersRepository.update(userId, { password: await this.hashProvider.generateHash(newPassword) });
    // Outras sessões abertas deixam de valer.
    await this.usersTokensRepository.deleteByUser(userId);
  }
}
