import type { NextFunction, Request, Response } from "express";
import type { UserRole } from "@modules/accounts/dtos/UserRole";
import { AppError } from "@shared/errors/AppError";

/** Libera a rota só para os perfis informados. Use depois de ensureAuthenticated. */
export function ensureRole(...roles: UserRole[]) {
  return (request: Request, _response: Response, next: NextFunction) => {
    if (!roles.includes(request.user.role)) throw new AppError("Você não tem permissão para esta ação.", 403);
    next();
  };
}
