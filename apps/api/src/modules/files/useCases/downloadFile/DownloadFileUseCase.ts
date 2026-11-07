import type { Readable } from "node:stream";
import { inject, injectable } from "tsyringe";
import type { IActor } from "@modules/accounts/dtos/IActor";
import type { StoredFile } from "@modules/files/infra/typeorm/entities/StoredFile";
import type { IFilesRepository } from "@modules/files/repositories/IFilesRepository";
import { ConversationSnapshot } from "@modules/support/services/ConversationSnapshot";
import type { IStorageProvider } from "@shared/container/providers/StorageProvider/IStorageProvider";
import { AppError } from "@shared/errors/AppError";

/**
 * Entrega o conteúdo de um arquivo, conferindo o acesso:
 * - foto de perfil: qualquer usuário logado;
 * - anexo: só quem pode ver a conversa (o funcionário dono, analistas e admins).
 */
@injectable()
export class DownloadFileUseCase {
  constructor(
    @inject("FilesRepository") private files: IFilesRepository,
    @inject("StorageProvider") private storage: IStorageProvider,
    @inject(ConversationSnapshot) private snapshot: ConversationSnapshot,
  ) {}

  async execute({ actor, fileId }: { actor: IActor; fileId: string }): Promise<{ file: StoredFile; stream: Readable }> {
    const file = await this.files.findById(fileId);
    if (!file) throw new AppError("Arquivo não encontrado.", 404);
    if (file.purpose === "attachment") {
      // Mesma regra (e mesmo 404) de quem não pode ver a conversa.
      await this.snapshot.findVisible(actor, file.conversationId!).catch(() => {
        throw new AppError("Arquivo não encontrado.", 404);
      });
    }
    return { file, stream: await this.storage.read(file.storageKey) };
  }
}
