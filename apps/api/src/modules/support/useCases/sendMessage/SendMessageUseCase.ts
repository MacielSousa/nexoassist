import { inject, injectable } from "tsyringe";
import type { IActor } from "@modules/accounts/dtos/IActor";
import type { IUsersRepository } from "@modules/accounts/repositories/IUsersRepository";
import type { IFilesRepository } from "@modules/files/repositories/IFilesRepository";
import { resolveAttachments } from "@modules/files/utils/resolveAttachments";
import type { IServiceDeskProvider } from "@modules/tickets/providers/ServiceDeskProvider/IServiceDeskProvider";
import type { IAgentRunner } from "@modules/support/agent/AgentRunner";
import { buildHistory } from "@modules/support/agent/buildHistory";
import type { ITurnResult, TurnEvent } from "@modules/support/agent/runAgentTurn";
import { TurnRecorder, type ITurnContext } from "@modules/support/agent/TurnContext";
import { MESSAGE_LIMIT, type IHandoff } from "@modules/support/dtos/supportTypes";
import { ConversationMap, type IMessageResponseDTO, type ISnapshotResponseDTO } from "@modules/support/mapper/ConversationMap";
import type { IConversationsRepository } from "@modules/support/repositories/IConversationsRepository";
import type { IDraftsRepository } from "@modules/support/repositories/IDraftsRepository";
import type { IMessagesRepository } from "@modules/support/repositories/IMessagesRepository";
import { ConversationSnapshot } from "@modules/support/services/ConversationSnapshot";
import { ConversationTimeline } from "@modules/support/services/ConversationTimeline";
import { AppError } from "@shared/errors/AppError";

/** Eventos enviados ao navegador enquanto o agent responde (SSE). */
export type SendMessageEvent =
  | { type: "user"; message: IMessageResponseDTO }
  | TurnEvent
  | { type: "done"; snapshot: ISnapshotResponseDTO }
  | { type: "error"; error: string };

interface IRequest {
  actor: IActor;
  text: string;
  /** Anexos já enviados (POST /conversations/:id/attachments). */
  attachmentIds?: string[];
  emit: (event: SendMessageEvent) => void;
  signal?: AbortSignal;
}

/** Uma resposta por vez por conversa (processo único; com várias instâncias, usar lock no banco/Redis). */
const runningTurns = new Set<string>();

/**
 * Mensagem do funcionário → resposta do agent em streaming.
 * Com a conversa aguardando ou com um analista, o agent fica pausado: a mensagem só é registrada.
 */
@injectable()
export class SendMessageUseCase {
  constructor(
    @inject("ConversationsRepository") private conversations: IConversationsRepository,
    @inject("MessagesRepository") private messages: IMessagesRepository,
    @inject("DraftsRepository") private drafts: IDraftsRepository,
    @inject("UsersRepository") private users: IUsersRepository,
    @inject("ServiceDeskProvider") private serviceDesk: IServiceDeskProvider,
    @inject("AgentRunner") private agent: IAgentRunner,
    @inject(ConversationTimeline) private timeline: ConversationTimeline,
    @inject(ConversationSnapshot) private snapshot: ConversationSnapshot,
    @inject("FilesRepository") private files: IFilesRepository,
  ) {}

  async execute({ actor, text, attachmentIds = [], emit, signal }: IRequest): Promise<void> {
    if (actor.role !== "employee") throw new AppError("O chat é para funcionários.", 403);
    const content = text.trim();
    if ((!content && attachmentIds.length === 0) || content.length > 2000) {
      throw new AppError("Escreva uma mensagem (até 2000 caracteres) ou envie um anexo.", 422);
    }

    const employee = await this.users.findById(actor.id);
    if (!employee) throw new AppError("Usuário não encontrado.", 404);
    const conversation = (await this.conversations.findActiveByEmployee(actor.id)) ?? (await this.conversations.create(actor.id));

    if ((await this.messages.countUserMessages(conversation.id)) >= MESSAGE_LIMIT) {
      throw new AppError(`Você chegou ao limite de ${MESSAGE_LIMIT} mensagens nesta conversa. Inicie uma nova.`, 429);
    }
    if (runningTurns.has(conversation.id)) throw new AppError("Aguarde a resposta anterior terminar.", 409);
    runningTurns.add(conversation.id);

    try {
      const attachments = await resolveAttachments(this.files, employee.id, conversation.id, attachmentIds);
      const userMessage = await this.timeline.post({ conversationId: conversation.id, role: "user", authorId: employee.id, authorName: employee.name, content, attachments });
      emit({ type: "user", message: ConversationMap.messageToDTO(userMessage) });

      if (conversation.status !== "agent") {
        emit({ type: "done", snapshot: await this.snapshot.build(conversation.id) });
        return;
      }

      if (!this.agent.isConfigured()) {
        await this.timeline.post({
          conversationId: conversation.id,
          role: "assistant",
          content: "O agent está sem a chave do provedor do modelo configurada (veja NEXO_MODEL e a chave correspondente no .env da API).",
        });
        emit({ type: "done", snapshot: await this.snapshot.build(conversation.id) });
        return;
      }

      const recorder = new TurnRecorder();
      const ctx: ITurnContext = {
        employee: { id: employee.id, name: employee.name, department: employee.department },
        actor,
        serviceDesk: this.serviceDesk,
        now: new Date(),
        recorder,
        createDraft: (payload) => this.drafts.create({ conversationId: conversation.id, employeeId: employee.id, payload }),
        requestHandoff: (handoff) => this.handoff(conversation.id, handoff),
      };

      const history = buildHistory(await this.messages.listByConversation(conversation.id), await this.drafts.listByConversation(conversation.id));
      const result = await this.agent.run(ctx, history, emit, signal).catch((err: unknown): ITurnResult => {
        console.error("[agent]", err);
        return {
          text: "Tive um problema para responder agora. Tente de novo em instantes ou peça para falar com um analista.",
          trace: { decision: recorder.decision, tools: recorder.tools, model: "", latencyMs: 0, usage: { inputTokens: 0, outputTokens: 0 }, error: err instanceof Error ? err.message : String(err) },
        };
      });

      let reply = result.text;
      // Rede de segurança: baixa confiança registrada e nenhuma transferência → o servidor transfere.
      const decision = recorder.decision;
      if (!recorder.handoff && decision && decision.confidence < 0.5) {
        recorder.handoff = {
          reason: "baixa_confianca",
          summary: `Agent sem segurança (${Math.round(decision.confidence * 100)}%): ${decision.intent}. ${decision.rationale}`,
          group: "Suporte N1",
          confidence: decision.confidence,
        };
        await this.handoff(conversation.id, recorder.handoff);
        recorder.step("transferiu para um analista");
        reply = `${reply}\n\nComo não tenho certeza do melhor caminho, chamei um analista para continuar com você.`.trim();
      }
      if (!reply && recorder.parts.length === 0) reply = "Pode me contar um pouco mais sobre o que está acontecendo?";

      await this.timeline.post({ conversationId: conversation.id, role: "assistant", content: reply, steps: recorder.steps, parts: recorder.parts, trace: result.trace });
      if (recorder.handoff) await this.timeline.post({ conversationId: conversation.id, role: "system", content: `Transferida para ${recorder.handoff.group}` });
      emit({ type: "done", snapshot: await this.snapshot.build(conversation.id) });
    } finally {
      runningTurns.delete(conversation.id);
    }
  }

  private async handoff(conversationId: string, h: IHandoff) {
    const conversation = (await this.conversations.findById(conversationId))!;
    Object.assign(conversation, {
      status: "waiting_human",
      // Zera a relação junto com o id: o TypeORM grava a FK a partir da relação carregada.
      assignedAnalystId: null,
      assignedAnalyst: null,
      handoffReason: h.reason,
      handoffSummary: h.summary,
      handoffTicket: h.ticketNumber ?? null,
      handoffGroup: h.group,
      handoffConfidence: h.confidence ?? null,
      handoffAt: new Date(),
    });
    await this.conversations.save(conversation);
  }
}
