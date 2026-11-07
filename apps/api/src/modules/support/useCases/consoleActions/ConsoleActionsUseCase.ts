import { inject, injectable } from "tsyringe";
import { can, type IActor } from "@modules/accounts/dtos/IActor";
import type { IUsersRepository } from "@modules/accounts/repositories/IUsersRepository";
import type { IFilesRepository } from "@modules/files/repositories/IFilesRepository";
import { resolveAttachments } from "@modules/files/utils/resolveAttachments";
import type { IServiceDeskProvider } from "@modules/tickets/providers/ServiceDeskProvider/IServiceDeskProvider";
import type { Conversation } from "@modules/support/infra/typeorm/entities/Conversation";
import type { ISnapshotResponseDTO } from "@modules/support/mapper/ConversationMap";
import type { IConversationsRepository } from "@modules/support/repositories/IConversationsRepository";
import { ConversationSnapshot } from "@modules/support/services/ConversationSnapshot";
import { ConversationTimeline } from "@modules/support/services/ConversationTimeline";
import { AppError } from "@shared/errors/AppError";

/**
 * Ações do analista sobre uma conversa:
 * - assumir: o agent pausa e só o analista responde;
 * - responder: mensagem do analista para o funcionário;
 * - devolver ao agent: o agent volta a atender;
 * - encerrar: fecha a conversa.
 */
@injectable()
export class ConsoleActionsUseCase {
  constructor(
    @inject("ConversationsRepository") private conversations: IConversationsRepository,
    @inject("UsersRepository") private users: IUsersRepository,
    @inject("ServiceDeskProvider") private serviceDesk: IServiceDeskProvider,
    @inject(ConversationTimeline) private timeline: ConversationTimeline,
    @inject(ConversationSnapshot) private snapshot: ConversationSnapshot,
    @inject("FilesRepository") private files: IFilesRepository,
  ) {}

  private async load(actor: IActor, id: string) {
    if (!can(actor, "console.attend")) throw new AppError("Você não tem permissão para atender conversas.", 403);
    const conversation = await this.conversations.findById(id);
    if (!conversation) throw new AppError("Conversa não encontrada.", 404);
    if (conversation.status === "closed") throw new AppError("Conversa encerrada.", 409);
    const analyst = (await this.users.findById(actor.id))!;
    return { conversation, analyst };
  }

  private ensureAssignedTo(conversation: Conversation, analystId: string) {
    if (conversation.status !== "human" || conversation.assignedAnalystId !== analystId) {
      throw new AppError("Assuma o atendimento antes.", 409);
    }
  }

  async takeOver(actor: IActor, id: string): Promise<ISnapshotResponseDTO> {
    const { conversation, analyst } = await this.load(actor, id);
    if (conversation.status === "human" && conversation.assignedAnalystId !== analyst.id) {
      throw new AppError(`${conversation.assignedAnalyst?.name} já está atendendo.`, 409);
    }
    Object.assign(conversation, { status: "human", assignedAnalystId: analyst.id, assignedAnalyst: analyst, handledById: analyst.id, takenAt: new Date() });
    await this.conversations.save(conversation);
    await this.timeline.post({ conversationId: id, role: "system", content: `${analyst.name} assumiu · agent pausado` });
    if (conversation.handoffTicket) {
      // Melhor esforço: o atendimento não depende do legado estar no ar.
      await this.serviceDesk.setStatus(actor, conversation.handoffTicket, "em_andamento").catch(() => undefined);
    }
    return this.snapshot.build(id);
  }

  async reply(actor: IActor, id: string, text: string, attachmentIds: string[] = []): Promise<ISnapshotResponseDTO> {
    const { conversation, analyst } = await this.load(actor, id);
    this.ensureAssignedTo(conversation, analyst.id);
    if (!text.trim() && attachmentIds.length === 0) throw new AppError("Escreva uma mensagem ou envie um anexo.", 422);
    const attachments = await resolveAttachments(this.files, analyst.id, id, attachmentIds);
    await this.timeline.post({ conversationId: id, role: "analyst", authorId: analyst.id, authorName: analyst.name, content: text.trim(), attachments });
    return this.snapshot.build(id);
  }

  async returnToAgent(actor: IActor, id: string): Promise<ISnapshotResponseDTO> {
    const { conversation, analyst } = await this.load(actor, id);
    if (conversation.status === "human" && conversation.assignedAnalystId !== analyst.id) {
      throw new AppError("Outro analista está atendendo.", 409);
    }
    Object.assign(conversation, { status: "agent", assignedAnalystId: null, assignedAnalyst: null });
    await this.conversations.save(conversation);
    await this.timeline.post({ conversationId: id, role: "system", content: `${analyst.name} devolveu a conversa ao agent` });
    return this.snapshot.build(id);
  }

  async close(actor: IActor, id: string): Promise<ISnapshotResponseDTO> {
    const { conversation, analyst } = await this.load(actor, id);
    this.ensureAssignedTo(conversation, analyst.id);
    await this.timeline.post({ conversationId: id, role: "system", content: `Atendimento encerrado por ${analyst.name}` });
    Object.assign(conversation, { status: "closed", resolvedBy: "analyst", closedAt: new Date(), closedById: analyst.id });
    await this.conversations.save(conversation);
    this.timeline.notify(id);
    return this.snapshot.build(id);
  }
}
