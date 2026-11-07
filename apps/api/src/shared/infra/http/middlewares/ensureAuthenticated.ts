import type { NextFunction, Request, Response } from "express";
import { verify } from "jsonwebtoken";
import { authConfig } from "@config/auth";
import type { UserRole } from "@modules/accounts/dtos/UserRole";
import { AppError } from "@shared/errors/AppError";

interface IPayload {
  sub: string;
  role: UserRole;
}

/**
 * Exige um JWT válido no header Authorization (Bearer) ou, para SSE (EventSource
 * não envia headers), no parâmetro ?access_token=.
 */
export function ensureAuthenticated(request: Request, _response: Response, next: NextFunction) {
  const header = request.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : (request.query.access_token as string | undefined);
  if (!token) throw new AppError("Token ausente.", 401);

  try {
    const { sub, role } = verify(token, authConfig.secret) as IPayload;
    request.user = { id: sub, role };
    next();
  } catch {
    throw new AppError("Token inválido ou expirado.", 401);
  }
}
