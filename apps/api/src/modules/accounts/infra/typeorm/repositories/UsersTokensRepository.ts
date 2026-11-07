import type { Repository } from "typeorm";
import type { IUsersTokensRepository } from "@modules/accounts/repositories/IUsersTokensRepository";
import { AppDataSource } from "@shared/infra/typeorm/data-source";
import { UserToken } from "../entities/UserToken";

export class UsersTokensRepository implements IUsersTokensRepository {
  private repository: Repository<UserToken>;

  constructor() {
    this.repository = AppDataSource.getRepository(UserToken);
  }

  create(data: { userId: string; refreshToken: string; expiresAt: Date }): Promise<UserToken> {
    return this.repository.save(this.repository.create(data));
  }

  findByRefreshToken(refreshToken: string): Promise<UserToken | null> {
    return this.repository.findOneBy({ refreshToken });
  }

  async deleteById(id: string): Promise<void> {
    await this.repository.delete(id);
  }

  async deleteByUser(userId: string): Promise<void> {
    await this.repository.delete({ userId });
  }
}
