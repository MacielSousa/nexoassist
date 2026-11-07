import { inject, injectable } from "tsyringe";
import type { IUsersRepository } from "@modules/accounts/repositories/IUsersRepository";
import type { IUsersTokensRepository } from "@modules/accounts/repositories/IUsersTokensRepository";
import { issueSessionTokens, type ISessionTokens } from "@modules/accounts/utils/tokens";
import { AppError } from "@shared/errors/AppError";

/** Troca um refresh token válido por um novo par de tokens (o antigo é invalidado). */
@injectable()
export class RefreshTokenUseCase {
  constructor(
    @inject("UsersRepository") private usersRepository: IUsersRepository,
    @inject("UsersTokensRepository") private usersTokensRepository: IUsersTokensRepository,
  ) {}

  async execute(refreshToken: string): Promise<ISessionTokens> {
    const stored = await this.usersTokensRepository.findByRefreshToken(refreshToken);
    if (!stored || stored.expiresAt < new Date()) throw new AppError("Sessão expirada. Entre novamente.", 401);

    await this.usersTokensRepository.deleteById(stored.id);
    const user = await this.usersRepository.findById(stored.userId);
    if (!user || !user.active) throw new AppError("Sessão expirada. Entre novamente.", 401);

    return issueSessionTokens(user, this.usersTokensRepository);
  }
}
