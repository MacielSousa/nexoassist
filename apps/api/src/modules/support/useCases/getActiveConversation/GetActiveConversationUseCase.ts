import { inject, injectable } from "tsyringe";
import { can, type IActor } from "@modules/accounts/dtos/IActor";
import type { ISnapshotResponseDTO } from "@modules/support/mapper/ConversationMap";
import type { IConversationsRepository } from "@modules/support/repositories/IConversationsRepository";
import { ConversationSnapshot } from "@modules/support/services/ConversationSnapshot";
import { AppError } from "@shared/errors/AppError";

/** A conversa em andamento do funcionário ("voltar outro dia e continuar de onde parei"). Cria se não houver. */
@injectable()
export class GetActiveConversationUseCase {
  constructor(
    @inject("ConversationsRepository") private conversations: IConversationsRepository,
    @inject(ConversationSnapshot) private snapshot: ConversationSnapshot,
  ) {}

  async execute(actor: IActor): Promise<ISnapshotResponseDTO> {
    if (!can(actor, "chat.use")) throw new AppError("Você não tem permissão para usar o chat.", 403);
    const conversation = (await this.conversations.findActiveByEmployee(actor.id)) ?? (await this.conversations.create(actor.id));
    return this.snapshot.build(conversation.id);
  }
}
