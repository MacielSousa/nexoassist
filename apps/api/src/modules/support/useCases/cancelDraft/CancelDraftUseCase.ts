import { inject, injectable } from "tsyringe";
import type { IActor } from "@modules/accounts/dtos/IActor";
import type { ISnapshotResponseDTO } from "@modules/support/mapper/ConversationMap";
import type { IConversationsRepository } from "@modules/support/repositories/IConversationsRepository";
import type { IDraftsRepository } from "@modules/support/repositories/IDraftsRepository";
import { ConversationSnapshot } from "@modules/support/services/ConversationSnapshot";
import { ConversationTimeline } from "@modules/support/services/ConversationTimeline";
import { findPendingDraft } from "../confirmDraft/ConfirmDraftUseCase";

@injectable()
export class CancelDraftUseCase {
  constructor(
    @inject("DraftsRepository") private drafts: IDraftsRepository,
    @inject("ConversationsRepository") private conversations: IConversationsRepository,
    @inject(ConversationTimeline) private timeline: ConversationTimeline,
    @inject(ConversationSnapshot) private snapshot: ConversationSnapshot,
  ) {}

  async execute({ actor, draftId }: { actor: IActor; draftId: string }): Promise<ISnapshotResponseDTO> {
    const draft = await findPendingDraft(this.drafts, this.conversations, actor, draftId);
    await this.drafts.updateStatus(draft.id, "cancelled");
    await this.timeline.post({ conversationId: draft.conversationId, role: "system", content: `Rascunho ${draft.id} cancelado` });
    return this.snapshot.build(draft.conversationId);
  }
}
