import type { UserToken } from "../infra/typeorm/entities/UserToken";

export interface IUsersTokensRepository {
  create(data: { userId: string; refreshToken: string; expiresAt: Date }): Promise<UserToken>;
  findByRefreshToken(refreshToken: string): Promise<UserToken | null>;
  deleteById(id: string): Promise<void>;
  deleteByUser(userId: string): Promise<void>;
}
