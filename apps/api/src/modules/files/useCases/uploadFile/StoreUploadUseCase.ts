import { inject, injectable } from "tsyringe";
import type { FilePurpose, StoredFile } from "@modules/files/infra/typeorm/entities/StoredFile";
import type { IFilesRepository } from "@modules/files/repositories/IFilesRepository";
import type { IStorageProvider } from "@shared/container/providers/StorageProvider/IStorageProvider";
import { AppError } from "@shared/errors/AppError";
import { detectFileType, MAX_BYTES, type FileKind } from "@shared/utils/detectFileType";

interface IRequest {
  ownerId: string;
  purpose: FilePurpose;
  conversationId: string | null;
  originalName: string;
  content: Buffer;
  /** Tipos aceitos neste contexto (foto de perfil: só imagem). */
  allowed: FileKind[];
}

const KIND_LABEL: Record<FileKind, string> = { image: "imagem", video: "vídeo", document: "documento" };

/**
 * Valida e guarda um arquivo enviado. O tipo vem do conteúdo (assinatura), não da extensão
 * nem do Content-Type; o tamanho é limitado por tipo.
 */
@injectable()
export class StoreUploadUseCase {
  constructor(
    @inject("FilesRepository") private files: IFilesRepository,
    @inject("StorageProvider") private storage: IStorageProvider,
  ) {}

  async execute({ ownerId, purpose, conversationId, originalName, content, allowed }: IRequest): Promise<StoredFile> {
    const type = detectFileType(content, originalName);
    if (!type || !allowed.includes(type.kind)) {
      const accepted = allowed.map((k) => KIND_LABEL[k]).join(", ");
      throw new AppError(`Tipo de arquivo não permitido. Aceitos: ${accepted} (JPG, PNG, WEBP, GIF, MP4, WEBM, MOV, PDF, DOCX, XLSX, PPTX, TXT, CSV).`, 415);
    }
    if (content.length > MAX_BYTES[type.kind]) {
      throw new AppError(`Arquivo grande demais: ${KIND_LABEL[type.kind]} até ${MAX_BYTES[type.kind] / 1024 / 1024} MB.`, 413);
    }

    const storageKey = await this.storage.save(content, type.ext);
    // Nome original só para exibição: sem caminho e com tamanho limitado.
    const safeName = originalName.split(/[\\/]/).pop()!.replace(/[\u0000-\u001f]/g, "").slice(0, 120) || `arquivo.${type.ext}`;
    return this.files.create({ ownerId, purpose, conversationId, originalName: safeName, mime: type.mime, size: content.length, storageKey });
  }
}
