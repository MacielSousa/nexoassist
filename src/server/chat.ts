import { TurnRecorder, toTicketView, type TurnContext } from "@/agent/context";
import { runAgentTurn, type HistoryMessage, type TurnEvent, type TurnResult } from "@/agent/run-turn";
import { ServiceDeskClient, ServiceDeskUnavailableError } from "@/agent/service-desk-client";
import type { DraftView, MessagePart, TurnTrace } from "@/agent/types";
import { formatDateTime } from "@/domain";
import type { User } from "./auth";
import type { ConversationStore } from "./conversations";
import { MESSAGE_LIMIT, type ChatStreamEvent, type ConversationSnapshot, type MessageDTO } from "./types";

// Orquestra o atendimento: quem responde (agent ou analista), rascunhos e transferências.
// Recebe as dependências por parâmetro para ser testável sem Next nem LLM.

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export interface ChatDeps {
  store: ConversationStore;
  clientFor(actor: { id: string; role: "employee" | "analyst" }): ServiceDeskClient;
  runTurn?: (ctx: TurnContext, history: HistoryMessage[], onEvent: (e: TurnEvent) => void, signal?: AbortSignal) => Promise<TurnResult>;
  now?: () => Date;
  /** Sem chave do modelo, o agent responde com uma mensagem de configuração em vez de quebrar. */
  modelConfigured?: boolean;
}

const HISTORY_WINDOW = 20;
const g = globalThis as unknown as { __turnLocks?: Set<number> };
const locks = (g.__turnLocks ??= new Set<number>());

/** Converte o histórico persistido no formato do LLM, descrevendo os cards em texto. */
export function buildHistory(messages: MessageDTO[], drafts: Record<string, DraftView>): HistoryMessage[] {
  const describe = (p: MessagePart): string => {
    switch (p.kind) {
      case "options":
        return `[opções mostradas: ${p.options.join(" | ")}]`;
      case "ticket_selector":
        return `[seletor de chamados mostrado: ${p.tickets.map((t) => t.number).join(", ")}]`;
      case "ticket":
        return `[card do chamado ${p.ticket.number}: ${p.ticket.statusLabel}, prioridade ${p.ticket.priority}${p.ticket.overdue ? ", vencido" : ""}]`;
      case "articles":
        return `[artigos: ${p.articles.map((a) => a.title).join("; ")}]`;
      case "draft": {
        const d = drafts[p.draftId];
        if (!d) return "";
        const status = { pending: "aguardando confirmação", confirmed: `confirmado (${d.resultTicket})`, cancelled: "cancelado", superseded: "substituído", failed: "falhou" }[d.status];
        return d.kind === "create"
          ? `[rascunho ${d.id} — "${d.title}", ${d.category}, prioridade ${d.priority}: ${status}]`
          : `[rascunho ${d.id} — ${d.reopen ? "reabrir" : "atualizar"} ${d.ticketNumber}: ${status}]`;
      }
    }
  };

  const out: HistoryMessage[] = [];
  for (const m of messages.slice(-HISTORY_WINDOW)) {
    let role: HistoryMessage["role"];
    let content: string;
    if (m.role === "user") {
      role = "user";
      content = m.content;
    } else if (m.role === "assistant") {
      role = "assistant";
      content = [m.content, ...m.parts.map(describe)].filter(Boolean).join("\n");
    } else if (m.role === "analyst") {
      role = "assistant";
      content = `[analista ${m.author?.name ?? ""}] ${m.content}`;
    } else {
      role = "assistant";
      content = `[sistema] ${m.content}`;
    }
    if (!content) continue;
    const prev = out[out.length - 1];
    if (prev && prev.role === role) prev.content += `\n\n${content}`;
    else out.push({ role, content } as HistoryMessage);
  }
  while (out[0]?.role === "assistant") out.shift();
  return out;
}

export async function sendEmployeeMessage(
  deps: ChatDeps,
  user: User,
  text: string,
  emit: (e: ChatStreamEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const { store } = deps;
  const now = deps.now ?? (() => new Date());
  const content = text.trim();
  if (!content || content.length > 2000) throw new ApiError(422, "A mensagem precisa ter entre 1 e 2000 caracteres.");

  const conv = store.activeOrCreate(user.id);
  if (conv.userMessageCount >= MESSAGE_LIMIT) {
    throw new ApiError(429, `Você chegou ao limite de ${MESSAGE_LIMIT} mensagens nesta sessão. Inicie uma nova conversa.`);
  }
  if (locks.has(conv.id)) throw new ApiError(409, "Aguarde a resposta anterior terminar.");
  locks.add(conv.id);

  try {
    emit({ type: "user", message: store.addMessage(conv.id, { role: "user", authorId: user.id, content }) });

    // Com um analista na conversa (ou aguardando um), o agent fica pausado.
    if (conv.status !== "agent") {
      emit({ type: "done", snapshot: store.snapshot(conv.id) });
      return;
    }

    if (deps.modelConfigured === false) {
      store.addMessage(conv.id, {
        role: "assistant",
        content: "O agent está sem a chave do provedor do modelo configurada no .env (ex.: OPENAI_API_KEY ou ANTHROPIC_API_KEY). Configure e tente de novo.",
      });
      emit({ type: "done", snapshot: store.snapshot(conv.id) });
      return;
    }

    const recorder = new TurnRecorder();
    const ctx: TurnContext = {
      employee: { id: user.id, name: user.name, department: user.department },
      client: deps.clientFor({ id: user.id, role: "employee" }),
      now: now(),
      recorder,
      createDraft: async (input) => store.createDraft(conv.id, user.id, input),
      requestHandoff: async (h) => store.handoff(conv.id, h),
    };

    const history = buildHistory(store.messages(conv.id), store.drafts(conv.id));
    let result: TurnResult;
    try {
      result = await (deps.runTurn ?? runAgentTurn)(ctx, history, (e) => emit(e), signal);
    } catch (err) {
      console.error("[agent]", err);
      result = {
        text: "Tive um problema para responder agora. Tente de novo em instantes ou peça para falar com um analista.",
        trace: {
          decision: recorder.decision,
          tools: recorder.tools,
          model: "",
          latencyMs: 0,
          usage: { inputTokens: 0, outputTokens: 0 },
          error: err instanceof Error ? err.message : String(err),
        },
      };
    }

    let reply = result.text;
    // Rede de segurança: se o agent registrou baixa confiança e não transferiu, o servidor transfere.
    const decision = recorder.decision;
    if (!recorder.handoff && decision && decision.confidence < 0.5) {
      recorder.handoff = {
        reason: "baixa_confianca",
        summary: `Agent sem segurança (${Math.round(decision.confidence * 100)}%): ${decision.intent}. ${decision.rationale}`,
        group: "Suporte N1",
        confidence: decision.confidence,
      };
      store.handoff(conv.id, recorder.handoff);
      recorder.step("transferiu para um analista");
      reply = `${reply}\n\nComo não tenho certeza do melhor caminho, chamei um analista para continuar com você.`.trim();
    }
    if (!reply && recorder.parts.length === 0) reply = "Pode me contar um pouco mais sobre o que está acontecendo?";

    store.addMessage(conv.id, { role: "assistant", content: reply, steps: recorder.steps, parts: recorder.parts, trace: result.trace });
    if (recorder.handoff) store.addMessage(conv.id, { role: "system", content: `Transferida para ${recorder.handoff.group}` });
    emit({ type: "done", snapshot: store.snapshot(conv.id) });
  } finally {
    locks.delete(conv.id);
  }
}

function ownDraft(store: ConversationStore, user: User, draftId: string) {
  const d = store.draft(draftId);
  if (!d || d.employeeId !== user.id) throw new ApiError(404, "Rascunho não encontrado.");
  if (d.status !== "pending") throw new ApiError(409, "Esse rascunho já foi resolvido.");
  const conv = store.get(d.conversationId);
  if (!conv || conv.status === "closed") throw new ApiError(409, "Essa conversa foi encerrada.");
  return d;
}

/** Criação/atualização determinística depois do clique em Confirmar (sem LLM no caminho). */
export async function confirmDraft(deps: ChatDeps, user: User, draftId: string): Promise<ConversationSnapshot> {
  const { store } = deps;
  const d = ownDraft(store, user, draftId);
  const client = deps.clientFor({ id: user.id, role: "employee" });
  const now = (deps.now ?? (() => new Date()))();
  const started = Date.now();

  try {
    const ticket =
      d.kind === "create"
        ? await client.createTicket(
            { type: d.type, title: d.title, description: d.description, category: d.category, priority: d.priority, affected: d.affected },
            d.id, // chave de idempotência: clique duplo não duplica o chamado
          )
        : await client.addComment(d.ticketNumber!, d.comment!, d.reopen ?? false);

    store.setDraftStatus(d.id, "confirmed", ticket.number);
    const view = toTicketView(ticket, now);
    const content =
      d.kind === "create"
        ? `Pronto: abri o ${ticket.number} com prioridade ${ticket.priority.toLowerCase()}. A primeira resposta chega até ${formatDateTime(view.deadline)}.`
        : d.reopen
          ? `Reabri o ${ticket.number} com a nova informação. A equipe responde até ${formatDateTime(view.deadline)}.`
          : `Atualizei o ${ticket.number} com a nova informação.`;
    const label = d.kind === "create" ? "criou o chamado" : d.reopen ? "reabriu o chamado" : "atualizou o chamado";
    const trace: TurnTrace = {
      decision: { intent: label, confidence: 1, rationale: `Confirmado pelo funcionário no rascunho ${d.id}.` },
      tools: [{ tool: d.kind === "create" ? "criar_chamado" : "atualizar_chamado", label, input: { rascunho: d.id }, output: { numero: ticket.number }, ok: true, ms: Date.now() - started }],
      model: "—",
      latencyMs: Date.now() - started,
      usage: { inputTokens: 0, outputTokens: 0 },
    };
    store.addMessage(d.conversationId, { role: "assistant", content, steps: [label], parts: [{ kind: "ticket", ticket: view }], trace });
    return store.snapshot(d.conversationId);
  } catch (err) {
    if (err instanceof ServiceDeskUnavailableError) {
      throw new ApiError(503, "O sistema de chamados está instável agora. Seu rascunho continua aqui; tente confirmar de novo em instantes.");
    }
    throw err;
  }
}

export function cancelDraft(deps: ChatDeps, user: User, draftId: string): ConversationSnapshot {
  const d = ownDraft(deps.store, user, draftId);
  deps.store.setDraftStatus(d.id, "cancelled");
  deps.store.addMessage(d.conversationId, { role: "system", content: `Rascunho ${d.id} cancelado` });
  return deps.store.snapshot(d.conversationId);
}

export function startNewConversation(deps: ChatDeps, user: User): ConversationSnapshot {
  const current = deps.store.active(user.id);
  if (current && (current.status === "waiting_human" || current.status === "human")) {
    throw new ApiError(409, "Um analista está cuidando da sua conversa atual.");
  }
  if (current) deps.store.close(current.id, "agent");
  return deps.store.snapshot(deps.store.activeOrCreate(user.id).id);
}

// ---- console do analista ----

function conversationFor(deps: ChatDeps, id: number) {
  const conv = deps.store.get(id);
  if (!conv) throw new ApiError(404, "Conversa não encontrada.");
  return conv;
}

export async function takeOver(deps: ChatDeps, analyst: User, id: number): Promise<ConversationSnapshot> {
  const conv = conversationFor(deps, id);
  if (conv.status === "closed") throw new ApiError(409, "Conversa encerrada.");
  if (conv.status === "human" && conv.assignedAnalyst?.id !== analyst.id) {
    throw new ApiError(409, `${conv.assignedAnalyst?.name} já está atendendo.`);
  }
  deps.store.assign(id, analyst.id);
  deps.store.addMessage(id, { role: "system", content: `${analyst.name} assumiu · agent pausado` });
  if (conv.handoff?.ticket) {
    // Melhor esforço: o atendimento não depende do legado estar no ar.
    await deps.clientFor({ id: analyst.id, role: "analyst" }).setStatus(conv.handoff.ticket, "em_andamento").catch(() => undefined);
  }
  return deps.store.snapshot(id);
}

function assignedTo(deps: ChatDeps, analyst: User, id: number) {
  const conv = conversationFor(deps, id);
  if (conv.status !== "human" || conv.assignedAnalyst?.id !== analyst.id) {
    throw new ApiError(409, "Assuma o atendimento antes.");
  }
  return conv;
}

export function giveBackToAgent(deps: ChatDeps, analyst: User, id: number): ConversationSnapshot {
  const conv = conversationFor(deps, id);
  if (conv.status === "closed") throw new ApiError(409, "Conversa encerrada.");
  if (conv.status === "human" && conv.assignedAnalyst?.id !== analyst.id) throw new ApiError(409, "Outro analista está atendendo.");
  deps.store.returnToAgent(id);
  deps.store.addMessage(id, { role: "system", content: `${analyst.name} devolveu a conversa ao agent` });
  return deps.store.snapshot(id);
}

export function closeConversation(deps: ChatDeps, analyst: User, id: number): ConversationSnapshot {
  assignedTo(deps, analyst, id);
  deps.store.addMessage(id, { role: "system", content: `Atendimento encerrado por ${analyst.name}` });
  deps.store.close(id, "analyst");
  return deps.store.snapshot(id);
}

export function sendAnalystMessage(deps: ChatDeps, analyst: User, id: number, text: string): ConversationSnapshot {
  assignedTo(deps, analyst, id);
  const content = text.trim();
  if (!content || content.length > 2000) throw new ApiError(422, "A mensagem precisa ter entre 1 e 2000 caracteres.");
  deps.store.addMessage(id, { role: "analyst", authorId: analyst.id, content });
  return deps.store.snapshot(id);
}
