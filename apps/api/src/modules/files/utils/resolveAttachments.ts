import { FileMap, type IFileResponseDTO } from "@modules/files/mapper/FileMap";
import type { IFilesRepository } from "@modules/files/repositories/IFilesRepository";
import { AppError } from "@shared/errors/AppError";

/** Máximo de anexos por mensagem. */
export const MAX_ATTACHMENTS = 5;

/**
 * Confere os anexos de uma mensagem: precisam ter sido enviados por quem manda a mensagem,
 * nesta conversa. Evita "pegar emprestado" arquivo de outra conversa pelo id.
 */
export async function resolveAttachments(files: IFilesRepository, ownerId: string, conversationId: string, ids: string[] = []): Promise<IFileResponseDTO[]> {
  const unique = [...new Set(ids)];
  if (unique.length > MAX_ATTACHMENTS) throw new AppError(`Envie no máximo ${MAX_ATTACHMENTS} anexos por mensagem.`, 422);
  const found = await files.findByIds(unique);
  const valid = found.filter((f) => f.purpose === "attachment" && f.ownerId === ownerId && f.conversationId === conversationId);
  if (valid.length !== unique.length) throw new AppError("Anexo inválido ou de outra conversa.", 422);
  return unique.map((id) => FileMap.toDTO(valid.find((f) => f.id === id)!));
}
