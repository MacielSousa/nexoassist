import { nexoModel } from "./nexoAgent";
import { runAgentTurn, type RunAgentTurn } from "./runAgentTurn";

/** Quem executa o agent. Nos testes, uma versão falsa substitui o LLM. */
export interface IAgentRunner {
  /** false quando falta a chave do provedor do modelo configurado. */
  isConfigured(): boolean;
  run: RunAgentTurn;
}

/** Variável de chave de cada provedor do roteador de modelos do Mastra. */
const PROVIDER_KEYS: Record<string, string> = {
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  google: "GOOGLE_GENERATIVE_AI_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
  groq: "GROQ_API_KEY",
  mistral: "MISTRAL_API_KEY",
  deepseek: "DEEPSEEK_API_KEY",
  xai: "XAI_API_KEY",
};

export class MastraAgentRunner implements IAgentRunner {
  run = runAgentTurn;

  isConfigured() {
    const key = PROVIDER_KEYS[nexoModel().split("/")[0]!];
    return key ? Boolean(process.env[key]) : true;
  }
}
