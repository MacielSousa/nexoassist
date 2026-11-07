import type { NextFunction, Request, Response, Router } from "express";
import type { ZodObject, ZodType } from "zod";
import type { UserRole } from "@modules/accounts/dtos/UserRole";
import { ErrorSchema, registry } from "./docs/openapi";
import { ensureAuthenticated } from "./middlewares/ensureAuthenticated";
import { ensureRole } from "./middlewares/ensureRole";

type Method = "get" | "post" | "put" | "patch" | "delete";

export interface RouteSpec {
  method: Method;
  /** Caminho no formato do Express, ex.: "/users/:id". */
  path: string;
  tag: string;
  summary: string;
  description?: string;
  /** false = rota pública; "any" = qualquer usuário autenticado; lista = só esses perfis. */
  auth: false | "any" | UserRole[];
  request?: { body?: ZodType; query?: ZodObject; params?: ZodObject };
  /** Respostas de sucesso documentadas. Os erros comuns são adicionados automaticamente. */
  responses: Record<number, { description: string; schema?: ZodType; contentType?: string }>;
  handler: (request: Request, response: Response, next: NextFunction) => unknown;
}

const toOpenApiPath = (path: string) => path.replace(/:(\w+)/g, "{$1}");

/**
 * Registra uma rota no Express e na documentação OpenAPI ao mesmo tempo.
 * A validação continua no controller (com os mesmos schemas), para ficar explícita.
 */
export function defineRoute(router: Router, prefix: string, spec: RouteSpec) {
  const fullPath = `${prefix}${spec.path === "/" ? "" : spec.path}` || "/";

  const errors: RouteSpec["responses"] = {};
  if (spec.request) errors[422] = { description: "Dados inválidos", schema: ErrorSchema };
  if (spec.auth) errors[401] = { description: "Não autenticado", schema: ErrorSchema };
  if (Array.isArray(spec.auth)) errors[403] = { description: "Sem permissão", schema: ErrorSchema };

  registry.registerPath({
    method: spec.method,
    path: toOpenApiPath(fullPath),
    tags: [spec.tag],
    summary: spec.summary,
    description: spec.description,
    security: spec.auth ? [{ bearerAuth: [] }] : undefined,
    request: {
      params: spec.request?.params,
      query: spec.request?.query,
      body: spec.request?.body ? { content: { "application/json": { schema: spec.request.body } } } : undefined,
    },
    responses: Object.fromEntries(
      Object.entries({ ...spec.responses, ...errors }).map(([status, r]) => [
        status,
        { description: r.description, content: r.schema ? { [r.contentType ?? "application/json"]: { schema: r.schema } } : undefined },
      ]),
    ),
  });

  const guards = [];
  if (spec.auth) guards.push(ensureAuthenticated);
  if (Array.isArray(spec.auth)) guards.push(ensureRole(...spec.auth));
  router[spec.method](spec.path, ...guards, spec.handler);
}
