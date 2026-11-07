import { randomUUID } from "node:crypto";
import { UserToken } from "@modules/accounts/infra/typeorm/entities/UserToken";
import type { IUsersTokensRepository } from "../IUsersTokensRepository";

export class UsersTokensRepositoryInMemory implements IUsersTokensRepository {
  tokens: UserToken[] = [];

  async create(data: { userId: string; refreshToken: string; expiresAt: Date }) {
    const token = Object.assign(new UserToken(), { ...data, id: randomUUID(), createdAt: new Date() });
    this.tokens.push(token);
    return token;
  }

  async findByRefreshToken(refreshToken: string) {
    return this.tokens.find((t) => t.refreshToken === refreshToken) ?? null;
  }

  async deleteById(id: string) {
    this.tokens = this.tokens.filter((t) => t.id !== id);
  }

  async deleteByUser(userId: string) {
    this.tokens = this.tokens.filter((t) => t.userId !== userId);
  }
}
