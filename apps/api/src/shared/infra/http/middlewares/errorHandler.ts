import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AppError } from "@shared/errors/AppError";

/** Converte erros em respostas HTTP. Erros inesperados viram 500 sem vazar detalhes. */
export function errorHandler(err: unknown, _request: Request, response: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return response.status(err.statusCode).json({ message: err.message });
  }
  if (err instanceof ZodError) {
    return response.status(422).json({
      message: "Dados inválidos.",
      issues: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    });
  }
  console.error(err);
  return response.status(500).json({ message: "Erro interno no servidor." });
}
