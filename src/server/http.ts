import { ServiceDeskClient } from "@/agent/service-desk-client";
import { appDb } from "./db";
import { ApiError, type ChatDeps } from "./chat";
import { ConversationStore } from "./conversations";

// Ligações do servidor para os route handlers.

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

function modelKeyPresent(): boolean {
  const provider = (process.env.NEXO_MODEL || "anthropic/claude-haiku-5-5").split("/")[0]!;
  const key = PROVIDER_KEYS[provider];
  return key ? Boolean(process.env[key]) : true;
}

export function chatDeps(req: Request): ChatDeps {
  const baseUrl = process.env.SERVICE_DESK_URL ?? `${new URL(req.url).origin}/api/service-desk`;
  const token = process.env.SERVICE_DESK_TOKEN ?? "dev-service-token";
  return {
    store: new ConversationStore(appDb()),
    clientFor: (actor) => new ServiceDeskClient({ baseUrl, token, actor }),
    modelConfigured: modelKeyPresent(),
  };
}

export async function handleErrors(fn: () => Promise<Response> | Response): Promise<Response> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof ApiError) return Response.json({ error: err.message }, { status: err.status });
    console.error("[api]", err);
    return Response.json({ error: "Algo deu errado. Tente de novo." }, { status: 500 });
  }
}

export function sse(producer: (send: (data: unknown) => void, signal: AbortSignal) => Promise<void>, req: Request): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let open = true;
      const send = (data: unknown) => {
        if (open) controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };
      try {
        await producer(send, req.signal);
      } catch (err) {
        send({ type: "error", error: err instanceof ApiError ? err.message : "Algo deu errado. Tente de novo." });
        if (!(err instanceof ApiError)) console.error("[sse]", err);
      } finally {
        open = false;
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: { "content-type": "text/event-stream", "cache-control": "no-cache, no-transform", connection: "keep-alive" },
  });
}
