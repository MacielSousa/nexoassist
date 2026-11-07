import { RequestContext } from "@mastra/core/request-context";
import { beforeEach, describe, expect, it } from "vitest";
import { handleServiceDesk, ServiceDeskRepository, type ServiceDeskOptions } from "@/service-desk";
import { TurnRecorder, type TurnContext } from "./context";
import { ServiceDeskClient, ServiceDeskUnavailableError } from "./service-desk-client";
import { getTicket, listMyTickets, prepareTicketDraft, prepareTicketUpdate, transferToAnalyst } from "./tools";
import type { DraftInput, DraftView, HandoffInput } from "./types";

const ANA = { id: "ana.souza@nexo.com.br", name: "Ana Souza", department: "Financeiro" };

let sd: ServiceDeskOptions;
let drafts: DraftView[];
let handoffs: HandoffInput[];

function fetchTo(opts: ServiceDeskOptions): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const req = new Request(input, init);
    const path = new URL(req.url).pathname.replace("/api/service-desk/", "").split("/");
    return handleServiceDesk(req, path, opts);
  }) as typeof fetch;
}

function makeCtx(employee = ANA): TurnContext {
  return {
    employee,
    now: new Date(),
    client: new ServiceDeskClient({
      baseUrl: "http://sd/api/service-desk",
      token: "t",
      actor: { id: employee.id, role: "employee" },
      fetch: fetchTo(sd),
      backoffMs: 1,
    }),
    recorder: new TurnRecorder(),
    createDraft: async (input: DraftInput) => {
      const d: DraftView = { ...input, id: `D-${drafts.length + 1}`, status: "pending" };
      drafts.push(d);
      return d;
    },
    requestHandoff: async (h) => {
      handoffs.push(h);
    },
  };
}

// As tools recebem o contexto do turno como o Mastra entrega em produção.
async function run<I>(tool: { execute?: (input: I, ctx: never) => Promise<unknown> }, input: I, ctx: TurnContext) {
  const requestContext = new RequestContext();
  requestContext.set("turn", ctx);
  return (await tool.execute!(input, { requestContext } as never)) as Record<string, unknown>;
}

beforeEach(() => {
  sd = {
    repo: new ServiceDeskRepository(":memory:"),
    token: "t",
    chaos: { failureRate: 0, outage: null, latencyMs: [0, 0] },
  };
  drafts = [];
  handoffs = [];
});

describe("tools do Nexo Assist", () => {
  it("lista só os chamados do funcionário da sessão e marca o vencido", async () => {
    const ctx = makeCtx();
    const out = (await run(listMyTickets, { incluir_encerrados: false }, ctx)) as {
      chamados: { numero: string; vencido: boolean }[];
    };
    expect(out.chamados.map((c) => c.numero).sort()).toEqual(["INC-20298", "INC-20311", "REQ-10442"]);
    expect(out.chamados.find((c) => c.numero === "INC-20311")?.vencido).toBe(true);
    expect(ctx.recorder.steps).toContain("consultou seus chamados");
  });

  it("não consegue consultar chamado de outra pessoa, mesmo se o LLM pedir", async () => {
    const out = await run(getTicket, { numero: "INC-20150" }, makeCtx());
    expect(out.erro).toMatch(/não encontrado/);
  });

  it("calcula prioridade pelas regras e cria um rascunho (não o chamado)", async () => {
    const ctx = makeCtx();
    const out = await run(
      prepareTicketDraft,
      {
        tipo: "INC",
        categoria: "Rede e VPN",
        titulo: "VPN não conecta no notebook — erro 809",
        descricao: "Desde ontem o notebook com Windows 11 não conecta na VPN e mostra o erro 809.",
        afetados: "individual",
        severidade: "atrapalha",
        compromisso_hoje: true,
        ignorar_duplicidade: false,
      },
      ctx,
    );
    expect(out.rascunho_criado).toBe(true);
    expect(out.prioridade).toBe("Alta");
    expect(drafts[0]?.priorityReason).toMatch(/compromisso/);
    expect(ctx.recorder.parts).toEqual([{ kind: "draft", draftId: "D-1" }]);
    expect(ctx.recorder.steps).toEqual(["verificou duplicidade", "classificou a prioridade", "consultou o SLA", "montou o rascunho"]);
    expect((await sd.repo.listByRequester(ANA.id, "all")).length).toBe(5); // nada criado ainda
  });

  it("bloqueia rascunho duplicado e devolve o chamado existente", async () => {
    const out = await run(
      prepareTicketDraft,
      {
        tipo: "INC",
        categoria: "Hardware",
        titulo: "Notebook continua lento",
        descricao: "O notebook segue lento depois da atualização do Windows.",
        afetados: "individual",
        severidade: "atrapalha",
        compromisso_hoje: false,
        ignorar_duplicidade: false,
      },
      makeCtx(),
    );
    expect(out.rascunho_criado).toBe(false);
    expect((out.candidatos as { number: string }[])[0]?.number).toBe("INC-20311");
    expect(drafts).toHaveLength(0);
  });

  it("só permite reabrir chamado resolvido há até 7 dias", async () => {
    const carla = { id: "carla.mendes@nexo.com.br", name: "Carla Mendes", department: "Compras" };
    const ok = await run(prepareTicketUpdate, { numero: "INC-20150", comentario: "O SAP bloqueou de novo hoje.", reabrir: true }, makeCtx(carla));
    expect(ok.rascunho_criado).toBe(true);
    const denied = await run(prepareTicketUpdate, { numero: "INC-19877", comentario: "Voltou a acontecer.", reabrir: true }, makeCtx());
    expect(denied.erro).toMatch(/não pode ser reaberto/);
  });

  it("transfere para um analista com resumo e atualiza o chamado", async () => {
    const ctx = makeCtx();
    await run(
      transferToAnalyst,
      {
        motivo: "prazo_vencido",
        resumo: "INC-20311 sem atualização há 6 dias; funcionária pediu analista.",
        numero_chamado: "INC-20311",
        nivel: "Suporte N2",
      },
      ctx,
    );
    expect(handoffs[0]).toMatchObject({ reason: "prazo_vencido", group: "Suporte N2", ticketNumber: "INC-20311" });
    expect(sd.repo.get("INC-20311")?.assignedGroup).toBe("Suporte N2");
  });

  it("devolve erro tratável quando o sistema de chamados está fora", async () => {
    sd.chaos.failureRate = 1;
    const out = await run(listMyTickets, { incluir_encerrados: false }, makeCtx());
    expect(out.erro).toMatch(/sistema_indisponivel/);
  });
});

describe("cliente do serviço de chamados", () => {
  it("repete a chamada quando o legado cai por alguns instantes", async () => {
    let calls = 0;
    const flaky = fetchTo(sd);
    const client = new ServiceDeskClient({
      baseUrl: "http://sd/api/service-desk",
      token: "t",
      actor: { id: ANA.id, role: "employee" },
      backoffMs: 1,
      fetch: (async (input: RequestInfo | URL, init?: RequestInit) => {
        calls++;
        if (calls < 3) return Response.json({}, { status: 503 });
        return flaky(input, init);
      }) as typeof fetch,
    });
    expect((await client.listTickets()).length).toBe(3);
    expect(calls).toBe(3);
  });

  it("desiste depois das tentativas", async () => {
    const client = new ServiceDeskClient({
      baseUrl: "http://sd/api/service-desk",
      token: "t",
      actor: { id: ANA.id, role: "employee" },
      backoffMs: 1,
      retries: 2,
      fetch: (async () => Response.json({}, { status: 503 })) as unknown as typeof fetch,
    });
    await expect(client.listTickets()).rejects.toBeInstanceOf(ServiceDeskUnavailableError);
  });
});
