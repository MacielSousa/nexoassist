/**
 * Erro de negócio com status HTTP. Lançado pelos use cases e convertido em resposta
 * pelo middleware de erros (shared/infra/http/middlewares/errorHandler).
 */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
    this.name = "AppError";
  }
}
