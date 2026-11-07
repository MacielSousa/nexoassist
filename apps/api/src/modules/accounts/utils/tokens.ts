import { createHash, randomBytes } from "node:crypto";
import { sign, type SignOptions } from "jsonwebtoken";
import { authConfig } from "@config/auth";
import type { User } from "../infra/typeorm/entities/User";
import type { IUsersTokensRepository } from "../repositories/IUsersTokensRepository";

export interface ISessionTokens {
  token: string;
  refreshToken: string;
}

/**
 * O banco guarda só o SHA-256 do refresh token: se a tabela vazar, os tokens não servem.
 * (Token aleatório de 256 bits: hash rápido sem sal é suficiente, ao contrário de senhas.)
 */
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/** Emite um token de acesso (JWT curto) e um refresh token opaco (o banco guarda o hash). */
export async function issueSessionTokens(user: User, tokens: IUsersTokensRepository): Promise<ISessionTokens> {
  // O token só identifica o usuário; as permissões são lidas do banco a cada requisição.
  const token = sign({}, authConfig.secret, {
    subject: user.id,
    algorithm: "HS256",
    expiresIn: authConfig.expiresIn as SignOptions["expiresIn"],
  });
  const refreshToken = randomBytes(32).toString("base64url");
  await tokens.create({
    userId: user.id,
    refreshToken: hashToken(refreshToken),
    expiresAt: new Date(Date.now() + authConfig.refreshTokenDays * 24 * 60 * 60 * 1000),
  });
  return { token, refreshToken };
}
