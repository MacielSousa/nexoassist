import { RequestContext } from "@mastra/core/request-context";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IActor } from "@modules/accounts/dtos/IActor";
import { UsersRepositoryInMemory } from "@modules/accounts/repositories/in-memory/UsersRepositoryInMemory";
import { FilesRepositoryInMemory } from "@modules/files/repositories/in-memory/FilesRepositoryInMemory";
import { LegacyServiceDeskProvider } from "@modules/tickets/providers/ServiceDeskProvider/implementations/LegacyServiceDeskProvider";
import { ArticlesRepositoryInMemory } from "@modules/tickets/repositories/in-memory/ArticlesRepositoryInMemory";
import { TicketsRepositoryInMemory } from "@modules/tickets/repositories/in-memory/TicketsRepositoryInMemory";
import type { IAgentRunner } from "../agent/AgentRunner";
import type { RunAgentTurn } from "../agent/runAgentTurn";
import { prepareTicketDraft, recordDecision, transferToAnalyst } from "../agent/tools";
import type { ITurnContext } from "../agent/TurnContext";
import { InMemoryConversationEvents } from "../providers/ConversationEventsProvider/implementations/InMemoryConversationEvents";
import { ConversationsRepositoryInMemory, DraftsRepositoryInMemory, MessagesRepositoryInMemory } from "../repositories/in-memory/SupportRepositoriesInMemory";
import { ConversationSnapshot } from "../services/ConversationSnapshot";
import { ConversationTimeline } from "../services/ConversationTimeline";
import { ConfirmDraftUseCase } from "./confirmDraft/ConfirmDraftUseCase";
import { ConsoleActionsUseCase } from "./consoleActions/ConsoleActionsUseCase";
import { SendMessageUseCase, type SendMessageEvent } from "./sendMessage/SendMessageUseCase";

let users: UsersRepositoryInMemory;
let tickets: TicketsRepositoryInMemory;
let conversations: ConversationsRepositoryInMemory;
let messages: MessagesRepositoryInMemory;
let drafts: DraftsRepositoryInMemory;
let serviceDesk: LegacyServiceDeskProvider;
let timeline: ConversationTimeline;
let snapshot: ConversationSnapshot;
let files: FilesRepositoryInMemory;
let ana: IActor;
let rafael: IActor;

const trace = { decision: null, tools: [], model: "fake", latencyMs: 1, usage: { inputTokens: 0, outputTokens: 0 } };

/** Executa uma tool como o Mastra faria em produção. */
const tool = (t: { execute?: (i: never, c: never) => Promise<unknown> }, input: unknown, ctx: ITurnContext) => {
  const requestContext = new RequestContext();
  requestContext.set("turn", ctx);
  return t.execute!(input as never, { requestContext } as never) as Promise<Record<string, unknown>>;
};

function sendMessage(run: RunAgentTurn, configured = true) {
  const agent: IAgentRunner = { isConfigured: () => configured, run };
  return new SendMessageUseCase(conversations, messages, drafts, users, serviceDesk, agent, timeline, snapshot, files);
}

const vpnDraft = {
  tipo: "INC",
  categoria: "Rede e VPN",
  titulo: "VPN não conecta — erro 809",
  descricao: "Notebook com Windows 11 não conecta na VPN desde ontem.",
  afetados: "individual",
  severidade: "impede_trabalho",
  compromisso_hoje: true,
  ignorar_duplicidade: false,
};

beforeEach(async () => {
  users = new UsersRepositoryInMemory();
  tickets = new TicketsRepositoryInMemory();
  conversations = new ConversationsRepositoryInMemory((id) => users.users.find((u) => u.id === id));
  messages = new MessagesRepositoryInMemory();
  drafts = new DraftsRepositoryInMemory();
  serviceDesk = new LegacyServiceDeskProvider(tickets, new ArticlesRepositoryInMemory(), users, { failureRate: 0, outage: null, latencyMs: [0, 0] });
  timeline = new ConversationTimeline(messages, conversations, new InMemoryConversationEvents());
  snapshot = new ConversationSnapshot(conversations, messages, drafts);
  files = new FilesRepositoryInMemory();
  ana = await users.createActor("Ana Souza", "employee", { department: "Financeiro" });
  rafael = await users.createActor("Rafael Lima", "analyst");
});

describe("Atendimento com o agent", () => {
  it("o agent monta o rascunho; o chamado só nasce na confirmação (idempotente)", async () => {
    const events: SendMessageEvent[] = [];
    await sendMessage(async (ctx) => {
      await tool(prepareTicketDraft, vpnDraft, ctx);
      return { text: "Confira antes de eu criar:", trace };
    }).execute({ actor: ana, text: "Minha VPN não conecta, erro 809", emit: (e) => events.push(e) });

    const done = events.at(-1);
    if (done?.type !== "done") throw new Error("esperava done");
    const [draftId, draft] = Object.entries(done.snapshot.drafts)[0]!;
    expect(draft).toMatchObject({ priority: "Alta", status: "pending" });
    expect(tickets.tickets).toHaveLength(0);

    const confirm = new ConfirmDraftUseCase(drafts, conversations, serviceDesk, timeline, snapshot);
    const after = await confirm.execute({ actor: ana, draftId });
    expect(after.messages.at(-1)?.content).toMatch(/^Pronto: abri o INC-20520 com prioridade alta/);
    await expect(confirm.execute({ actor: ana, draftId })).rejects.toMatchObject({ statusCode: 409 });
    expect(tickets.tickets).toHaveLength(1);
  });

  it("a identidade vem da sessão: outro funcionário não confirma o rascunho da Ana", async () => {
    await sendMessage(async (ctx) => {
      await tool(prepareTicketDraft, vpnDraft, ctx);
      return { text: "ok", trace };
    }).execute({ actor: ana, text: "VPN", emit: () => undefined });
    const carla = await users.createActor("Carla", "employee");
    const confirm = new ConfirmDraftUseCase(drafts, conversations, serviceDesk, timeline, snapshot);
    await expect(confirm.execute({ actor: carla, draftId: drafts.drafts[0]!.id })).rejects.toMatchObject({ statusCode: 404 });
  });

  it("transfere sozinho quando o agent registra baixa confiança", async () => {
    await sendMessage(async (ctx) => {
      await tool(recordDecision, { intencao: "impressora em branco", confianca: 0.41, justificativa: "Não sei se é toner ou a fila." }, ctx);
      return { text: "Não tenho certeza do que está causando isso.", trace };
    }).execute({ actor: ana, text: "A impressora imprime em branco", emit: () => undefined });

    const conversation = (await conversations.findActiveByEmployee(ana.id))!;
    expect(conversation).toMatchObject({ status: "waiting_human", handoffReason: "baixa_confianca", handoffConfidence: 0.41 });
    expect(messages.messages.at(-1)).toMatchObject({ role: "system", content: "Transferida para Suporte N1" });
  });

  it("transferência pedida pelo funcionário chega ao analista com resumo", async () => {
    await sendMessage(async (ctx) => {
      await tool(transferToAnalyst, { motivo: "pedido_do_funcionario", resumo: "Quer falar com um analista sobre a VPN que não conecta.", nivel: "Suporte N2" }, ctx);
      return { text: "Encaminhei para o Suporte N2.", trace };
    }).execute({ actor: ana, text: "Quero falar com um analista", emit: () => undefined });
    const conversation = (await conversations.findActiveByEmployee(ana.id))!;
    expect(conversation).toMatchObject({ status: "waiting_human", handoffGroup: "Suporte N2" });
  });

  it("pausa o agent enquanto o analista atende e retoma ao devolver", async () => {
    const run = vi.fn<RunAgentTurn>(async () => ({ text: "ok", trace }));
    const conversation = await conversations.create(ana.id);
    const consoleActions = new ConsoleActionsUseCase(conversations, users, serviceDesk, timeline, snapshot, files);

    await consoleActions.takeOver(rafael, conversation.id);
    await sendMessage(run).execute({ actor: ana, text: "Oi, alguém aí?", emit: () => undefined });
    expect(run).not.toHaveBeenCalled();

    await consoleActions.reply(rafael, conversation.id, "Oi, Ana! Sou o Rafael.");
    await consoleActions.returnToAgent(rafael, conversation.id);
    await sendMessage(run).execute({ actor: ana, text: "Obrigada!", emit: () => undefined });
    expect(run).toHaveBeenCalledTimes(1);
    expect(messages.messages.map((m) => m.role)).toEqual(["system", "user", "analyst", "system", "user", "assistant"]);
  });

  it("só quem assumiu responde e encerra", async () => {
    const conversation = await conversations.create(ana.id);
    const consoleActions = new ConsoleActionsUseCase(conversations, users, serviceDesk, timeline, snapshot, files);
    await expect(consoleActions.reply(rafael, conversation.id, "oi")).rejects.toMatchObject({ statusCode: 409 });
    await expect(consoleActions.takeOver(ana, conversation.id)).rejects.toMatchObject({ statusCode: 403 });
  });

  it("respeita o limite de 30 mensagens por conversa", async () => {
    const send = sendMessage(async () => ({ text: "ok", trace }));
    for (let i = 0; i < 30; i++) await send.execute({ actor: ana, text: `mensagem ${i}`, emit: () => undefined });
    await expect(send.execute({ actor: ana, text: "mais uma", emit: () => undefined })).rejects.toMatchObject({ statusCode: 429 });
  });

  it("falha do modelo vira mensagem amigável com o motivo no trace", async () => {
    const events: SendMessageEvent[] = [];
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await sendMessage(async () => {
      throw new Error("You have no credits remaining");
    }).execute({ actor: ana, text: "oi", emit: (e) => events.push(e) });
    errorLog.mockRestore();
    const done = events.at(-1);
    if (done?.type !== "done") throw new Error("esperava done");
    expect(done.snapshot.messages.at(-1)).toMatchObject({ content: expect.stringMatching(/Tive um problema/), trace: { error: "You have no credits remaining" } });
  });

  it("sem chave do modelo, avisa em vez de quebrar", async () => {
    const run = vi.fn<RunAgentTurn>();
    await sendMessage(run, false).execute({ actor: ana, text: "oi", emit: () => undefined });
    expect(run).not.toHaveBeenCalled();
    expect(messages.messages.at(-1)?.content).toMatch(/sem a chave do provedor/);
  });
});
