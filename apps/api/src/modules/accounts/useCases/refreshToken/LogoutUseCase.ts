import { inject, injectable } from "tsyringe";
import { hashToken } from "@modules/accounts/utils/tokens";
import type { IUsersTokensRepository } from "@modules/accounts/repositories/IUsersTokensRepository";

/** Invalida o refresh token da sessão. Idempotente. */
@injectable()
export class LogoutUseCase {
  constructor(@inject("UsersTokensRepository") private usersTokensRepository: IUsersTokensRepository) {}

  async execute(refreshToken: string): Promise<void> {
    const stored = await this.usersTokensRepository.findByRefreshToken(hashToken(refreshToken));
    if (stored) await this.usersTokensRepository.deleteById(stored.id);
  }
}
