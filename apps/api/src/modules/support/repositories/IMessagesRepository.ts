import type { IFileResponseDTO } from "@modules/files/mapper/FileMap";
import type { ITurnTrace, MessagePart, MessageRole } from "../dtos/supportTypes";
import type { Message } from "../infra/typeorm/entities/Message";

export interface ICreateMessageDTO {
  conversationId: string;
  role: MessageRole;
  content: string;
  authorId?: string | null;
  authorName?: string | null;
  steps?: string[];
  parts?: MessagePart[];
  attachments?: IFileResponseDTO[];
  trace?: ITurnTrace | null;
}

export interface IMessagesRepository {
  create(data: ICreateMessageDTO): Promise<Message>;
  /** Em ordem; só as com id maior que `afterId`. */
  listByConversation(conversationId: string, afterId?: number): Promise<Message[]>;
  countUserMessages(conversationId: string, since?: Date): Promise<number>;
  /** Última mensagem visível (não "system") de cada conversa. */
  lastVisibleByConversation(conversationIds: string[]): Promise<Map<string, Message>>;
}
