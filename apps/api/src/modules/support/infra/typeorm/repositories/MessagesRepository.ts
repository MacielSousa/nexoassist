import { MoreThan, MoreThanOrEqual, type Repository } from "typeorm";
import type { ICreateMessageDTO, IMessagesRepository } from "@modules/support/repositories/IMessagesRepository";
import { AppDataSource } from "@shared/infra/typeorm/data-source";
import { Message } from "../entities/Message";

export class MessagesRepository implements IMessagesRepository {
  private repository: Repository<Message>;

  constructor() {
    this.repository = AppDataSource.getRepository(Message);
  }

  create(data: ICreateMessageDTO): Promise<Message> {
    return this.repository.save(this.repository.create({ steps: [], parts: [], attachments: [], trace: null, ...data }));
  }

  listByConversation(conversationId: string, afterId = 0): Promise<Message[]> {
    return this.repository.find({ where: { conversationId, id: MoreThan(afterId) }, order: { id: "ASC" } });
  }

  countUserMessages(conversationId: string, since?: Date): Promise<number> {
    return this.repository.countBy({ conversationId, role: "user", ...(since ? { createdAt: MoreThanOrEqual(since) } : {}) });
  }

  async lastVisibleByConversation(conversationIds: string[]): Promise<Map<string, Message>> {
    if (conversationIds.length === 0) return new Map();
    const rows = await this.repository
      .createQueryBuilder("m")
      .distinctOn(["m.conversation_id"])
      .where("m.conversation_id IN (:...ids)", { ids: conversationIds })
      .andWhere("m.role <> 'system'")
      .orderBy("m.conversation_id")
      .addOrderBy("m.id", "DESC")
      .getMany();
    return new Map(rows.map((m) => [m.conversationId, m]));
  }
}
