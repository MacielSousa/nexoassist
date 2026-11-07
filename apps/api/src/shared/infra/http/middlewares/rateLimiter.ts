import type { NextFunction, Request, Response } from "express";
import { AppError } from "@shared/errors/AppError";

/**
 * Limite simples por IP em memória (janela fixa). Suficiente para uma instância;
 * com várias instâncias, trocar por Redis (como no rentx com rate-limiter-flexible).
 */
export function rateLimiter({ windowMs, max }: { windowMs: number; max: number }) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return (request: Request, _response: Response, next: NextFunction) => {
    const key = request.ip ?? "unknown";
    const now = Date.now();
    const entry = hits.get(key);
    if (!entry || entry.resetAt < now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    entry.count++;
    if (entry.count > max) throw new AppError("Muitas requisições. Tente de novo em instantes.", 429);
    next();
  };
}
