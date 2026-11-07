import { inject, injectable } from "tsyringe";
import { z } from "zod";
import { ConversationMap, ConversationResponseSchema } from "@modules/support/mapper/ConversationMap";
import { MESSAGE_ROLES } from "@modules/support/dtos/supportTypes";
import type { IConversationsRepository } from "@modules/support/repositories/IConversationsRepository";
import type { IMessagesRepository } from "@modules/support/repositories/IMessagesRepository";

export const ConsoleItemSchema = z
  .object({
    conversation: ConversationResponseSchema,
    lastMessage: z.object({ role: z.enum(MESSAGE_ROLES), content: z.string(), createdAt: z.iso.datetime() }).nullable(),
    unread: z.number().meta({ description: "Mensagens do funcionário desde a transferência (só aguardando atendente)" }),
  })
  .meta({ id: "ConsoleItem" });
export type IConsoleItemDTO = z.infer<typeof ConsoleItemSchema>;

/** Lista do console: conversas em andamento + encerradas nos últimos 3 dias. */
@injectable()
export class ListConsoleConversationsUseCase {
  constructor(
    @inject("ConversationsRepository") private conversations: IConversationsRepository,
    @inject("MessagesRepository") private messages: IMessagesRepository,
  ) {}

  async execute(): Promise<IConsoleItemDTO[]> {
    const conversations = await this.conversations.listForConsole(new Date(Date.now() - 3 * 24 * 60 * 60 * 1000));
    const last = await this.messages.lastVisibleByConversation(conversations.map((c) => c.id));
    return Promise.all(
      conversations.map(async (c) => {
        const m = last.get(c.id);
        const waiting = c.status === "waiting_human" && c.handoffAt;
        return {
          conversation: ConversationMap.toDTO(c, await this.messages.countUserMessages(c.id)),
          lastMessage: m ? { role: m.role, content: m.content, createdAt: m.createdAt.toISOString() } : null,
          unread: waiting ? Math.max(1, await this.messages.countUserMessages(c.id, c.handoffAt!)) : 0,
        };
      }),
    );
  }
}
