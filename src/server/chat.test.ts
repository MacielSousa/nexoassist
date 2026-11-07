import { beforeEach, describe, expect, it, vi } from "vitest";

// O módulo de auth importa next/headers; aqui só usamos o tipo User.
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

import { ServiceDeskClient } from "@/agent/service-desk-client";
import type { TurnContext } from "@/agent/context";
import { prepareTicketDraft, recordDecision } from "@/agent/tools";
import { RequestContext } from "@mastra/core/request-context";
import { handleServiceDesk, ServiceDeskRepository, type ServiceDeskOptions } from "@/service-desk";
import type { User } from "./auth";
import { ApiError, buildHistory, confirmDraft, giveBackToAgent, sendEmployeeMessage, takeOver, type ChatDeps } from "./chat";
import { ConversationStore } from "./conversations";
import { openAppDb } from "./db";
import type { ChatStreamEvent } from "./types";

const ana: User = {
  id: "ana.souza@nexo.com.br",
  name: "Ana Souza",
  role: "employee",
  department: "Financeiro",
  initials: "AS",
  avatarBg: "",
  avatarFg: "",
  passwordChangedAt: "",
};
const rafael: User = { ...ana, id: "rafael.lima@nexo.com.br", name: "Rafael Lima", role: "analyst", department: "Suporte N2" };

let sd: ServiceDeskOptions;
let deps: ChatDeps;
let events: ChatStreamEvent[];

const tool = async (t: { execute?: (i: never, c: never) => Promise<unknown> }, input: unknown, ctx: TurnContext) => {
  const requestContext = new RequestContext();
  requestContext.set("turn", ctx);
  return t.execute!(input as never, { requestContext } as never);
};

beforeEach(() => {
  sd = { repo: new ServiceDeskRepository(":memory:"), token: "t", chaos: { failureRate: 0, outage: null, latencyMs: [0, 0] } };
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const req = new Request(input, init);
    return handleServiceDesk(req, new URL(req.url).pathname.replace("/api/service-desk/", "").split("/"), sd);
  }) as typeof fetch;
  deps = {
    store: new ConversationStore(openAppDb(":memory:")),
    clientFor: (actor) => new ServiceDeskClient({ baseUrl: "http://sd/api/service-desk", token: "t", actor, fetch: fetchImpl, backoffMs: 1 }),
    modelConfigured: true,
  };
  events = [];
});

const trace = { decision: null, tools: [], model: "fake", latencyMs: 1, usage: { inputTokens: 0, outputTokens: 0 } };

describe("orquestração do atendimento", () => {
  it("cria rascunho pelo agent e só cria o chamado na confirmação (idempotente)", async () => {
    deps.runTurn = async (ctx) => {
      await tool(
        prepareTicketDraft,
        {
          tipo: "INC",
          categoria: "Rede e VPN",
          titulo: "VPN não conecta — erro 809",
          descricao: "Notebook com Windows 11 não conecta na VPN desde ontem.",
          afetados: "individual",
          severidade: "impede_trabalho",
          compromisso_hoje: true,
          ignorar_duplicidade: false,
        },
        ctx,
      );
      return { text: "Confira antes de eu criar:", trace };
    };
    await sendEmployeeMessage(deps, ana, "Minha VPN não conecta, erro 809", (e) => events.push(e));
    const done = events.at(-1);
    if (done?.type !== "done") throw new Error("esperava done");
    const draftId = Object.keys(done.snapshot.drafts)[0]!;
    expect(done.snapshot.drafts[draftId]?.priority).toBe("Alta");

    const first = await confirmDraft(deps, ana, draftId);
    expect(first.messages.at(-1)?.content).toMatch(/^Pronto: abri o INC-20520/);
    await expect(confirmDraft(deps, ana, draftId)).rejects.toBeInstanceOf(ApiError);
    expect(sd.repo.listByRequester(ana.id, "all").filter((t) => t.number === "INC-20520")).toHaveLength(1);
  });

  it("outro funcionário não confirma o rascunho da Ana", async () => {
    const conv = deps.store.activeOrCreate(ana.id);
    const draft = deps.store.createDraft(conv.id, ana.id, {
      kind: "create", type: "INC", title: "Teste de rascunho", description: "Descrição do teste", category: "Outros",
      priority: "Baixa", priorityReason: "", affected: "individual", slaLabel: "", deadline: new Date().toISOString(),
    });
    const carla = { ...ana, id: "carla.mendes@nexo.com.br" };
    await expect(confirmDraft(deps, carla, draft.id)).rejects.toMatchObject({ status: 404 });
  });

  it("transfere sozinho quando o agent registra baixa confiança", async () => {
    deps.runTurn = async (ctx) => {
      await tool(recordDecision, { intencao: "impressora em branco", confianca: 0.41, justificativa: "Não sei se é toner ou a fila." }, ctx);
      return { text: "Não tenho certeza do que está causando isso.", trace };
    };
    await sendEmployeeMessage(deps, ana, "A impressora imprime em branco", (e) => events.push(e));
    const conv = deps.store.active(ana.id)!;
    expect(conv.status).toBe("waiting_human");
    expect(conv.handoff).toMatchObject({ reason: "baixa_confianca", confidence: 0.41 });
    expect(deps.store.messages(conv.id).at(-1)).toMatchObject({ role: "system", content: "Transferida para Suporte N1" });
  });

  it("pausa o agent enquanto um analista atende e retoma ao devolver", async () => {
    const runTurn = vi.fn(async () => ({ text: "ok", trace }));
    deps.runTurn = runTurn;
    const conv = deps.store.activeOrCreate(ana.id);
    deps.store.handoff(conv.id, { reason: "pedido_do_funcionario", summary: "Quer falar com analista.", group: "Suporte N2" });
    await takeOver(deps, rafael, conv.id);

    await sendEmployeeMessage(deps, ana, "Oi, alguém aí?", (e) => events.push(e));
    expect(runTurn).not.toHaveBeenCalled();

    giveBackToAgent(deps, rafael, conv.id);
    await sendEmployeeMessage(deps, ana, "Obrigada!", (e) => events.push(e));
    expect(runTurn).toHaveBeenCalledTimes(1);
  });

  it("respeita o limite de 30 mensagens por sessão", async () => {
    deps.runTurn = async () => ({ text: "ok", trace });
    for (let i = 0; i < 30; i++) await sendEmployeeMessage(deps, ana, `mensagem ${i}`, () => undefined);
    await expect(sendEmployeeMessage(deps, ana, "mais uma", () => undefined)).rejects.toMatchObject({ status: 429 });
  });

  it("responde com mensagem amigável quando o modelo falha", async () => {
    deps.runTurn = async () => {
      throw new Error("rate limited");
    };
    await sendEmployeeMessage(deps, ana, "oi", (e) => events.push(e));
    const done = events.at(-1);
    if (done?.type !== "done") throw new Error("esperava done");
    const last = done.snapshot.messages.at(-1)!;
    expect(last.content).toMatch(/Tive um problema/);
    expect(last.trace?.error).toBe("rate limited");
  });
});

describe("histórico enviado ao LLM", () => {
  it("descreve os cards e junta mensagens seguidas do mesmo papel", () => {
    const history = buildHistory(
      [
        { id: 1, role: "assistant", author: null, content: "Olá", steps: [], parts: [], trace: null, createdAt: "" },
        { id: 2, role: "user", author: null, content: "VPN caiu", steps: [], parts: [], trace: null, createdAt: "" },
        { id: 3, role: "assistant", author: null, content: "Confira:", steps: [], parts: [{ kind: "draft", draftId: "D-1" }], trace: null, createdAt: "" },
        { id: 4, role: "system", author: null, content: "Rascunho D-1 cancelado", steps: [], parts: [], trace: null, createdAt: "" },
      ],
      {
        "D-1": {
          id: "D-1", kind: "create", status: "cancelled", type: "INC", title: "VPN", description: "", category: "Rede e VPN",
          priority: "Alta", priorityReason: "", affected: "individual", slaLabel: "", deadline: "",
        },
      },
    );
    expect(history).toHaveLength(2);
    expect(history[0]).toEqual({ role: "user", content: "VPN caiu" });
    expect(history[1]?.content).toContain('[rascunho D-1 — "VPN", Rede e VPN, prioridade Alta: cancelado]');
    expect(history[1]?.content).toContain("[sistema] Rascunho D-1 cancelado");
  });
});
