import type { Request, Response } from "express";
import { container } from "tsyringe";
import { z } from "zod";
import { DownloadFileUseCase } from "./downloadFile/DownloadFileUseCase";
import { UploadAttachmentUseCase } from "./uploadAttachment/UploadAttachmentUseCase";

/** Tipos que o navegador pode exibir direto; o resto é sempre baixado. */
const INLINE = /^(image\/(jpeg|png|gif|webp)|video\/(mp4|webm|quicktime)|application\/pdf)$/;

export class FilesController {
  static idParams = z.object({ id: z.uuid() });
  static conversationParams = z.object({ id: z.uuid() });
  /** Só para o Swagger desenhar o campo de arquivo. */
  static uploadBody = z.object({ file: z.string().meta({ format: "binary", description: "Imagem, vídeo ou documento" }) });

  async uploadAttachment(request: Request, response: Response) {
    const { id } = FilesController.conversationParams.parse(request.params);
    const file = await container.resolve(UploadAttachmentUseCase).execute({
      actor: request.user,
      conversationId: id,
      originalName: request.file!.originalname,
      content: request.file!.buffer,
    });
    return response.status(201).json(file);
  }

  async download(request: Request, response: Response) {
    const { id } = FilesController.idParams.parse(request.params);
    const { file, stream } = await container.resolve(DownloadFileUseCase).execute({ actor: request.user, fileId: id });
    const disposition = INLINE.test(file.mime) ? "inline" : "attachment";
    response.setHeader("Content-Type", file.mime);
    response.setHeader("Content-Length", String(file.size));
    response.setHeader("Content-Disposition", `${disposition}; filename*=UTF-8''${encodeURIComponent(file.originalName)}`);
    // O navegador não deve "adivinhar" outro tipo, e o conteúdo é privado.
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Content-Security-Policy", "default-src 'none'; img-src 'self'; media-src 'self'; sandbox");
    response.setHeader("Cache-Control", "private, max-age=3600");
    stream.on("error", () => response.destroy());
    stream.pipe(response);
  }
}
