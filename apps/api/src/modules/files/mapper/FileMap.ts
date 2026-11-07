import { z } from "zod";
import type { FileKind } from "@shared/utils/detectFileType";
import type { StoredFile } from "../infra/typeorm/entities/StoredFile";

export const FileResponseSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    mime: z.string(),
    size: z.number().meta({ description: "Bytes" }),
    kind: z.enum(["image", "video", "document"]),
    url: z.string().meta({ description: "GET autenticado que devolve o conteúdo" }),
  })
  .meta({ id: "File" });

export type IFileResponseDTO = z.infer<typeof FileResponseSchema>;

export const kindOf = (mime: string): FileKind => (mime.startsWith("image/") ? "image" : mime.startsWith("video/") ? "video" : "document");

export class FileMap {
  static toDTO(file: StoredFile): IFileResponseDTO {
    return { id: file.id, name: file.originalName, mime: file.mime, size: file.size, kind: kindOf(file.mime), url: `/files/${file.id}` };
  }
}
