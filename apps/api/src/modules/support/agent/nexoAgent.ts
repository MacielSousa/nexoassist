import { Agent } from "@mastra/core/agent";
import { NEXO_INSTRUCTIONS } from "./instructions";
import { nexoTools } from "./tools";
import type { ITurnContext } from "./TurnContext";

/** Modelo no formato do roteador de modelos do Mastra: "<provedor>/<modelo>". */
export const nexoModel = () => process.env.NEXO_MODEL || "anthropic/claude-haiku-5-5";

function contextLines(ctx: ITurnContext | undefined): string {
  if (!ctx) return "";
  const now = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "full", timeStyle: "short" }).format(ctx.now);
  return `\n\nContexto\n- Funcionário: ${ctx.employee.name} (${ctx.employee.department}).\n- Agora: ${now} (horário de Brasília).`;
}

export const nexoAgent = new Agent({
  id: "nexo-assist",
  name: "Nexo Assist",
  description: "Agent de atendimento do service desk de TI da Nexo.",
  instructions: ({ requestContext }) => NEXO_INSTRUCTIONS + contextLines(requestContext.get("turn") as ITurnContext | undefined),
  model: () => nexoModel(),
  tools: nexoTools,
});
