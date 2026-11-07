import { inject, injectable } from "tsyringe";
import { can, type IActor } from "@modules/accounts/dtos/IActor";
import { UserMap, type IUserResponseDTO } from "@modules/accounts/mapper/UserMap";
import type { IUsersRepository } from "@modules/accounts/repositories/IUsersRepository";
import type { IFilesRepository } from "@modules/files/repositories/IFilesRepository";
import { StoreUploadUseCase } from "@modules/files/useCases/uploadFile/StoreUploadUseCase";
import type { IStorageProvider } from "@shared/container/providers/StorageProvider/IStorageProvider";
import { AppError } from "@shared/errors/AppError";

/** Foto de perfil: o próprio usuário ou quem tem users.manage pode trocar/remover. Só imagem, até 5 MB. */
@injectable()
export class UpdateAvatarUseCase {
  constructor(
    @inject("UsersRepository") private users: IUsersRepository,
    @inject("FilesRepository") private files: IFilesRepository,
    @inject("StorageProvider") private storage: IStorageProvider,
    @inject(StoreUploadUseCase) private store: StoreUploadUseCase,
  ) {}

  private async target(actor: IActor, userId: string) {
    if (actor.id !== userId && !can(actor, "users.manage")) throw new AppError("Você só pode alterar a sua própria foto.", 403);
    const user = await this.users.findById(userId);
    if (!user) throw new AppError("Usuário não encontrado.", 404);
    return user;
  }

  async update({ actor, userId, originalName, content }: { actor: IActor; userId: string; originalName: string; content: Buffer }): Promise<IUserResponseDTO> {
    const user = await this.target(actor, userId);
    const file = await this.store.execute({ ownerId: actor.id, purpose: "avatar", conversationId: null, originalName, content, allowed: ["image"] });
    const previous = user.avatarFileId;
    const updated = await this.users.update(userId, { avatarFileId: file.id });
    if (previous) await this.discard(previous);
    return UserMap.toDTO(updated);
  }

  async remove({ actor, userId }: { actor: IActor; userId: string }): Promise<IUserResponseDTO> {
    const user = await this.target(actor, userId);
    const updated = await this.users.update(userId, { avatarFileId: null });
    if (user.avatarFileId) await this.discard(user.avatarFileId);
    return UserMap.toDTO(updated);
  }

  /** Apaga a foto antiga (registro e conteúdo): não guardamos fotos que ninguém usa. */
  private async discard(fileId: string) {
    const file = await this.files.findById(fileId);
    if (!file) return;
    await this.files.delete(file.id);
    await this.storage.delete(file.storageKey);
  }
}
