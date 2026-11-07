import { inject, injectable } from "tsyringe";
import { can, type IActor } from "@modules/accounts/dtos/IActor";
import { ConversationMap, type ISnapshotResponseDTO } from "../mapper/ConversationMap";
import type { IConversationsRepository } from "../repositories/IConversationsRepository";
import type { IDraftsRepository } from "../repositories/IDraftsRepository";
import type { IMessagesRepository } from "../repositories/IMessagesRepository";
import type { Conversation } from "../infra/typeorm/entities/Conversation";
import { AppError } from "@shared/errors/AppError";

/** Monta a "foto" de uma conversa (estado + mensagens + rascunhos) e confere quem pode vê-la. */
@injectable()
export class ConversationSnapshot {
  constructor(
    @inject("ConversationsRepository") private conversations: IConversationsRepository,
    @inject("MessagesRepository") private messages: IMessagesRepository,
    @inject("DraftsRepository") private drafts: IDraftsRepository,
  ) {}

  /** Cada um vê a própria conversa; com console.view, todas. */
  async findVisible(actor: IActor, conversationId: string): Promise<Conversation> {
    const conversation = await this.conversations.findById(conversationId);
    if (!conversation || (!can(actor, "console.view") && conversation.employeeId !== actor.id)) {
      throw new AppError("Conversa não encontrada.", 404);
    }
    return conversation;
  }

  async build(conversationId: string, afterMessageId = 0): Promise<ISnapshotResponseDTO> {
    const conversation = (await this.conversations.findById(conversationId))!;
    const [messages, drafts, count] = await Promise.all([
      this.messages.listByConversation(conversationId, afterMessageId),
      this.drafts.listByConversation(conversationId),
      this.messages.countUserMessages(conversationId),
    ]);
    return {
      conversation: ConversationMap.toDTO(conversation, count),
      messages: messages.map(ConversationMap.messageToDTO),
      drafts: Object.fromEntries(drafts.map((d) => [d.id, ConversationMap.draftToDTO(d)])),
    };
  }
}
