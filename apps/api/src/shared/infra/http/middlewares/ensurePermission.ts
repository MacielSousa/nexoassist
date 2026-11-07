import type { NextFunction, Request, Response } from "express";
import { can } from "@modules/accounts/dtos/IActor";
import type { Permission } from "@modules/accounts/dtos/permissions";
import { AppError } from "@shared/errors/AppError";

/** Libera a rota para quem tem pelo menos uma das permissões. Use depois de ensureAuthenticated. */
export function ensurePermission(...permissions: Permission[]) {
  return (request: Request, _response: Response, next: NextFunction) => {
    if (!can(request.user, ...permissions)) throw new AppError("Você não tem permissão para esta ação.", 403);
    next();
  };
}
