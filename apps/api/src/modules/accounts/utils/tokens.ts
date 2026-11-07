import { randomBytes } from "node:crypto";
import { sign, type SignOptions } from "jsonwebtoken";
import { authConfig } from "@config/auth";
import type { User } from "../infra/typeorm/entities/User";
import type { IUsersTokensRepository } from "../repositories/IUsersTokensRepository";

export interface ISessionTokens {
  token: string;
  refreshToken: string;
}

/** Emite um token de acesso (JWT curto) e um refresh token opaco salvo no banco. */
export async function issueSessionTokens(user: User, tokens: IUsersTokensRepository): Promise<ISessionTokens> {
  const token = sign({ role: user.role }, authConfig.secret, {
    subject: user.id,
    expiresIn: authConfig.expiresIn as SignOptions["expiresIn"],
  });
  const refreshToken = randomBytes(32).toString("base64url");
  await tokens.create({
    userId: user.id,
    refreshToken,
    expiresAt: new Date(Date.now() + authConfig.refreshTokenDays * 24 * 60 * 60 * 1000),
  });
  return { token, refreshToken };
}
