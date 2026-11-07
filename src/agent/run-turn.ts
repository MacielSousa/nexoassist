import { RequestContext } from "@mastra/core/request-context";
import { NEXO_MODEL, nexoAgent } from "./agent";
import type { TurnContext } from "./context";
import type { TurnTrace } from "./types";

export type HistoryMessage = { role: "user"; content: string } | { role: "assistant"; content: string };

export type TurnEvent =
  | { type: "steps"; steps: string[] }
  | { type: "text"; delta: string }
  | { type: "text-reset" };

export interface TurnResult {
  text: string;
  trace: TurnTrace;
}

/** Limite de passos por resposta: protege custo e evita laços de tools. */
const MAX_STEPS = 8;

export async function runAgentTurn(
  ctx: TurnContext,
  history: HistoryMessage[],
  onEvent: (event: TurnEvent) => void,
  signal?: AbortSignal,
): Promise<TurnResult> {
  const requestContext = new RequestContext();
  requestContext.set("turn", ctx);
  const started = Date.now();

  const output = await nexoAgent.stream(history, {
    requestContext,
    maxSteps: MAX_STEPS,
    modelSettings: { temperature: 0.2, maxOutputTokens: 900 },
    abortSignal: signal,
  });

  let text = "";
  let pendingReset = false;
  const reader = output.fullStream.getReader();
  for (;;) {
    const { done, value: chunk } = await reader.read();
    if (done) break;
    switch (chunk.type) {
      case "text-delta":
        if (pendingReset) {
          // Texto escrito antes de uma tool ("vou verificar...") é narração intermediária:
          // a resposta final é o texto depois da última tool.
          text = "";
          pendingReset = false;
          onEvent({ type: "text-reset" });
        }
        text += chunk.payload.text;
        onEvent({ type: "text", delta: chunk.payload.text });
        break;
      case "tool-call":
        if (text) pendingReset = true;
        break;
      case "tool-result":
        onEvent({ type: "steps", steps: [...ctx.recorder.steps] });
        break;
      case "error":
        throw chunk.payload.error instanceof Error ? chunk.payload.error : new Error(String(chunk.payload.error));
    }
  }

  const usage = await output.totalUsage;
  return {
    text: text.trim(),
    trace: {
      decision: ctx.recorder.decision,
      tools: ctx.recorder.tools,
      model: NEXO_MODEL,
      latencyMs: Date.now() - started,
      usage: { inputTokens: usage.inputTokens ?? 0, outputTokens: usage.outputTokens ?? 0 },
    },
  };
}
