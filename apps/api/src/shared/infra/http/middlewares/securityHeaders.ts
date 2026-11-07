import type { NextFunction, Request, Response } from "express";

/** Cabeçalhos de segurança básicos para todas as respostas da API (equivalente enxuto do helmet). */
export function securityHeaders(_request: Request, response: Response, next: NextFunction) {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  response.setHeader("Strict-Transport-Security", "max-age=15552000; includeSubDomains");
  next();
}
