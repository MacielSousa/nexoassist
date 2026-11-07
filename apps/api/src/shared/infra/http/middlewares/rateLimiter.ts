import type { NextFunction, Request, Response } from "express";
import { AppError } from "@shared/errors/AppError";

interface IOptions {
  windowMs: number;
  max: number;
  /** Chave do contador (padrão: IP). Ex.: IP + e-mail no login. */
  key?: (request: Request) => string;
  message?: string;
}

/**
 * Limite simples em memória (janela fixa). Suficiente para uma instância;
 * com várias instâncias, trocar por Redis (como no rentx com rate-limiter-flexible).
 */
export function rateLimiter({ windowMs, max, key = (r) => r.ip ?? "unknown", message = "Muitas requisições. Tente de novo em instantes." }: IOptions) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return (request: Request, response: Response, next: NextFunction) => {
    const id = key(request);
    const now = Date.now();
    // Limpeza preguiçosa para o mapa não crescer sem limite.
    if (hits.size > 10_000) for (const [k, v] of hits) if (v.resetAt < now) hits.delete(k);
    const entry = hits.get(id);
    if (!entry || entry.resetAt < now) {
      hits.set(id, { count: 1, resetAt: now + windowMs });
      return next();
    }
    entry.count++;
    if (entry.count > max) {
      response.setHeader("Retry-After", String(Math.ceil((entry.resetAt - now) / 1000)));
      throw new AppError(message, 429);
    }
    next();
  };
}

/**
 * Contra força bruta de senha:
 * - por conta (e-mail), independente do IP: trocar/forjar o IP não ajuda o atacante;
 * - por IP, mais folgado: atrapalha quem testa muitas contas da mesma origem.
 *   (Em produção, um proxy reverso deve sobrescrever o X-Forwarded-For.)
 */
export const loginLimiters = [
  rateLimiter({
    windowMs: 15 * 60_000,
    max: 10,
    key: (r) => `login|${String((r.body as { email?: unknown })?.email ?? "").trim().toLowerCase()}`,
    message: "Muitas tentativas de entrar. Aguarde 15 minutos e tente de novo.",
  }),
  rateLimiter({ windowMs: 15 * 60_000, max: 50, message: "Muitas tentativas de entrar a partir desta rede. Aguarde alguns minutos." }),
];

/** Rotas que conferem a senha atual (troca de senha/e-mail): por usuário autenticado. */
export const passwordCheckLimiter = rateLimiter({
  windowMs: 15 * 60_000,
  max: 10,
  key: (r) => `pwd|${r.user?.id ?? r.ip}`,
  message: "Muitas tentativas com a senha atual. Aguarde 15 minutos.",
});
