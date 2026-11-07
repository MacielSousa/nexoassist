import { inject, injectable } from "tsyringe";
import type { IConversationEventsProvider } from "../providers/ConversationEventsProvider/IConversationEventsProvider";
import type { IConversationsRepository } from "../repositories/IConversationsRepository";
import type { ICreateMessageDTO, IMessagesRepository } from "../repositories/IMessagesRepository";
import type { Message } from "../infra/typeorm/entities/Message";

/** Publica mensagens numa conversa: salva, marca atividade e avisa quem está assistindo. */
@injectable()
export class ConversationTimeline {
  constructor(
    @inject("MessagesRepository") private messages: IMessagesRepository,
    @inject("ConversationsRepository") private conversations: IConversationsRepository,
    @inject("ConversationEventsProvider") private events: IConversationEventsProvider,
  ) {}

  async post(data: ICreateMessageDTO): Promise<Message> {
    const message = await this.messages.create(data);
    await this.conversations.touch(data.conversationId);
    this.events.publish(data.conversationId);
    return message;
  }

  /** Mudança de estado sem mensagem (ex.: rascunho confirmado). */
  notify(conversationId: string) {
    this.events.publish(conversationId);
  }
}
