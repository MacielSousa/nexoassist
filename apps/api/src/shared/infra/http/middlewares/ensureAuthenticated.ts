import type { NextFunction, Request, Response } from "express";
import { verify } from "jsonwebtoken";
import { container } from "tsyringe";
import { authConfig } from "@config/auth";
import { actorOf } from "@modules/accounts/dtos/IActor";
import type { IUsersRepository } from "@modules/accounts/repositories/IUsersRepository";
import { AppError } from "@shared/errors/AppError";

/**
 * Exige um JWT válido no header Authorization (Bearer). Nunca na URL: URLs acabam em logs
 * e históricos. (O SSE passa pelo proxy do web, que põe o header a partir do cookie.)
 *
 * As permissões são lidas do banco a cada requisição (não ficam no token): mudar a role
 * ou desativar um usuário vale na hora, sem esperar o token expirar.
 */
export async function ensureAuthenticated(request: Request, _response: Response, next: NextFunction) {
  const header = request.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  if (!token) throw new AppError("Token ausente.", 401);

  let userId: string;
  try {
    userId = (verify(token, authConfig.secret, { algorithms: ["HS256"] }) as { sub: string }).sub;
  } catch {
    throw new AppError("Token inválido ou expirado.", 401);
  }

  const user = await container.resolve<IUsersRepository>("UsersRepository").findById(userId);
  if (!user || !user.active) throw new AppError("Sessão inválida. Entre novamente.", 401);
  request.user = actorOf(user);
  next();
}
