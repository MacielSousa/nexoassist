import type { Repository } from "typeorm";
import type { DraftStatus, IDraftPayload } from "@modules/support/dtos/supportTypes";
import type { IDraftsRepository } from "@modules/support/repositories/IDraftsRepository";
import { AppDataSource } from "@shared/infra/typeorm/data-source";
import { Draft } from "../entities/Draft";

export class DraftsRepository implements IDraftsRepository {
  private repository: Repository<Draft>;

  constructor() {
    this.repository = AppDataSource.getRepository(Draft);
  }

  create(data: { conversationId: string; employeeId: string; payload: IDraftPayload }): Promise<Draft> {
    return AppDataSource.transaction(async (manager) => {
      await manager.update(Draft, { conversationId: data.conversationId, status: "pending" }, { status: "superseded" });
      const [row] = (await manager.query(`SELECT nextval('draft_seq') AS value`)) as { value: string }[];
      return manager.save(manager.create(Draft, { ...data, id: `D-${row!.value}`, status: "pending", resultTicket: null }));
    });
  }

  findById(id: string): Promise<Draft | null> {
    return this.repository.findOneBy({ id });
  }

  listByConversation(conversationId: string): Promise<Draft[]> {
    return this.repository.find({ where: { conversationId }, order: { createdAt: "ASC" } });
  }

  async updateStatus(id: string, status: DraftStatus, resultTicket?: string): Promise<void> {
    await this.repository.update(id, { status, resultTicket: resultTicket ?? null });
  }
}
