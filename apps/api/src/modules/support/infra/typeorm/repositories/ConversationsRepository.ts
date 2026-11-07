import { MoreThan, Not, type Repository } from "typeorm";
import type { IConversationsRepository } from "@modules/support/repositories/IConversationsRepository";
import { AppDataSource } from "@shared/infra/typeorm/data-source";
import { Conversation } from "../entities/Conversation";

const relations = { employee: true, assignedAnalyst: true };

export class ConversationsRepository implements IConversationsRepository {
  private repository: Repository<Conversation>;

  constructor() {
    this.repository = AppDataSource.getRepository(Conversation);
  }

  async create(employeeId: string): Promise<Conversation> {
    const { id } = await this.repository.save(this.repository.create({ employeeId, status: "agent" }));
    return (await this.findById(id))!;
  }

  findById(id: string): Promise<Conversation | null> {
    return this.repository.findOne({ where: { id }, relations });
  }

  findActiveByEmployee(employeeId: string): Promise<Conversation | null> {
    return this.repository.findOne({ where: { employeeId, status: Not("closed") }, relations });
  }

  listForConsole(closedSince: Date): Promise<Conversation[]> {
    return this.repository.find({
      where: [{ status: Not("closed") }, { updatedAt: MoreThan(closedSince) }],
      relations,
      order: { updatedAt: "DESC" },
      take: 100,
    });
  }

  async save(conversation: Conversation): Promise<Conversation> {
    await this.repository.save(conversation);
    return (await this.findById(conversation.id))!;
  }

  async touch(id: string): Promise<void> {
    await this.repository.update(id, { updatedAt: new Date() });
  }
}
