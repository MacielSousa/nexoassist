import { inject, injectable } from "tsyringe";
import type { IActor } from "@modules/accounts/dtos/IActor";
import type { ISnapshotResponseDTO } from "@modules/support/mapper/ConversationMap";
import type { IConversationsRepository } from "@modules/support/repositories/IConversationsRepository";
import { ConversationSnapshot } from "@modules/support/services/ConversationSnapshot";
import { AppError } from "@shared/errors/AppError";

/** Encerra a conversa atual (se estiver só com o agent) e começa outra. */
@injectable()
export class StartNewConversationUseCase {
  constructor(
    @inject("ConversationsRepository") private conversations: IConversationsRepository,
    @inject(ConversationSnapshot) private snapshot: ConversationSnapshot,
  ) {}

  async execute(actor: IActor): Promise<ISnapshotResponseDTO> {
    if (actor.role !== "employee") throw new AppError("O chat é para funcionários.", 403);
    const current = await this.conversations.findActiveByEmployee(actor.id);
    if (current && current.status !== "agent") throw new AppError("Um analista está cuidando da sua conversa atual.", 409);
    if (current) {
      current.status = "closed";
      current.resolvedBy = "agent";
      current.closedAt = new Date();
      await this.conversations.save(current);
    }
    const conversation = await this.conversations.create(actor.id);
    return this.snapshot.build(conversation.id);
  }
}
