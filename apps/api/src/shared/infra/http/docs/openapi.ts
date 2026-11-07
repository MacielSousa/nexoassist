import { OpenAPIRegistry, OpenApiGeneratorV31 } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

/**
 * Registro da documentação OpenAPI. Cada rota se registra aqui ao ser definida
 * (ver shared/infra/http/defineRoute), usando os mesmos schemas zod que validam a requisição.
 * Assim o Swagger nunca fica desatualizado em relação ao código.
 */
export const registry = new OpenAPIRegistry();

registry.registerComponent("securitySchemes", "bearerAuth", {
  type: "http",
  scheme: "bearer",
  bearerFormat: "JWT",
  description: "Token de acesso obtido em POST /sessions.",
});

export const ErrorSchema = z
  .object({
    message: z.string(),
    issues: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
  })
  .meta({ id: "Error" });

export function openApiDocument() {
  return new OpenApiGeneratorV31(registry.definitions).generateDocument({
    openapi: "3.1.0",
    info: {
      title: "Nexo Assist API",
      version: "1.0.0",
      description: [
        "API do service desk de TI da Nexo: contas, chamados, central de ajuda e atendimento com o agent.",
        "",
        "Para testar: faça login em **POST /sessions** (ex.: `admin@nexo.com.br`, senha do seed), copie o `token` e clique em **Authorize**.",
      ].join("\n"),
    },
    servers: [{ url: "/" }],
    tags: [
      { name: "Sessões", description: "Login, renovação de token e logout" },
      { name: "Perfil", description: "Dados do usuário autenticado" },
      { name: "Usuários", description: "Cadastro de funcionários, analistas e admins (só admin)" },
      { name: "Chamados", description: "Chamados do service desk" },
      { name: "Central de ajuda", description: "Artigos de autoatendimento" },
      { name: "Atendimento", description: "Chat do funcionário com o agent" },
      { name: "Console", description: "Console do analista: assumir, devolver e encerrar conversas" },
      { name: "Arquivos", description: "Fotos de perfil e anexos do chat" },
      { name: "Relatórios", description: "Indicadores por período, analista, fila, categoria, prioridade e status" },
    ],
  });
}
