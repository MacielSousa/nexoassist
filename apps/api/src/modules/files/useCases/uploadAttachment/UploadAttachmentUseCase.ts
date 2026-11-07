import { inject, injectable } from "tsyringe";
import type { IActor } from "@modules/accounts/dtos/IActor";
import { FileMap, type IFileResponseDTO } from "@modules/files/mapper/FileMap";
import { ConversationSnapshot } from "@modules/support/services/ConversationSnapshot";
import { AppError } from "@shared/errors/AppError";
import { StoreUploadUseCase } from "../uploadFile/StoreUploadUseCase";

/**
 * Anexo do chat (imagem, vídeo ou documento). Pode enviar o funcionário dono da conversa
 * ou o analista que a assumiu. O arquivo fica preso à conversa: só os participantes baixam.
 */
@injectable()
export class UploadAttachmentUseCase {
  constructor(
    @inject(ConversationSnapshot) private snapshot: ConversationSnapshot,
    @inject(StoreUploadUseCase) private store: StoreUploadUseCase,
  ) {}

  async execute({ actor, conversationId, originalName, content }: { actor: IActor; conversationId: string; originalName: string; content: Buffer }): Promise<IFileResponseDTO> {
    const conversation = await this.snapshot.findVisible(actor, conversationId);
    if (conversation.status === "closed") throw new AppError("Conversa encerrada.", 409);
    if (conversation.employeeId !== actor.id && conversation.assignedAnalystId !== actor.id) {
      throw new AppError("Assuma o atendimento para enviar anexos.", 409);
    }
    const file = await this.store.execute({
      ownerId: actor.id,
      purpose: "attachment",
      conversationId,
      originalName,
      content,
      allowed: ["image", "video", "document"],
    });
    return FileMap.toDTO(file);
  }
}
