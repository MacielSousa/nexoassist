import type { Affected, Priority } from "./types";

// A prioridade combina impacto (quantas pessoas) e urgência (se há compromisso em risco).
// O LLM só extrai os fatos; a classificação é determinística e auditável.

export const SEVERITIES = ["parado", "impede_trabalho", "atrapalha", "sem_urgencia"] as const;
export type Severity = (typeof SEVERITIES)[number];

export interface PriorityInput {
  affected: Affected;
  severity: Severity;
  /** Há um compromisso no mesmo dia que depende da solução (reunião, entrega, cliente). */
  sameDayCommitment: boolean;
}

export interface PriorityDecision {
  priority: Priority;
  reason: string;
}

const RANK: Record<Priority, number> = { Baixa: 0, Média: 1, Alta: 2, Crítica: 3 };

function max(a: Priority, b: Priority): Priority {
  return RANK[a] >= RANK[b] ? a : b;
}

export function classifyPriority(input: PriorityInput): PriorityDecision {
  const { affected, severity, sameDayCommitment } = input;
  const collective = affected !== "individual";

  if (collective && (severity === "parado" || severity === "impede_trabalho")) {
    return {
      priority: "Crítica",
      reason: affected === "empresa" ? "Algo parado para a empresa." : "Algo parado para uma equipe.",
    };
  }

  let priority: Priority;
  let reason: string;
  switch (severity) {
    case "parado":
    case "impede_trabalho":
      priority = "Alta";
      reason = "Impede uma pessoa de trabalhar.";
      break;
    case "atrapalha":
      priority = "Média";
      reason = "Atrapalha, mas há alternativa.";
      break;
    case "sem_urgencia":
      priority = "Baixa";
      reason = "Pedido ou melhoria sem urgência.";
      break;
  }

  if (sameDayCommitment && RANK[priority] < RANK.Alta) {
    priority = max(priority, "Alta");
    reason = "Há um compromisso no mesmo dia.";
  } else if (sameDayCommitment) {
    reason += " Há um compromisso no mesmo dia.";
  }

  return { priority, reason };
}
