import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import { AppError } from "@shared/errors/AppError";
import { MAX_BYTES } from "@shared/utils/detectFileType";

// Arquivo em memória (o use case valida tipo e tamanho e grava no StorageProvider).
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: Math.max(...Object.values(MAX_BYTES)), files: 1, fields: 5 },
}).single("file");

/** Lê um arquivo do campo "file" (multipart/form-data) e traduz os erros do multer. */
export function uploadSingleFile(request: Request, response: Response, next: NextFunction) {
  upload(request, response, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      return next(new AppError(err.code === "LIMIT_FILE_SIZE" ? "Arquivo grande demais." : "Envio de arquivo inválido.", err.code === "LIMIT_FILE_SIZE" ? 413 : 422));
    }
    if (err) return next(err);
    if (!request.file) return next(new AppError("Envie o arquivo no campo \"file\" (multipart/form-data).", 422));
    // Nomes chegam em latin1 no multipart; converte para UTF-8 para manter acentos.
    request.file.originalname = Buffer.from(request.file.originalname, "latin1").toString("utf8");
    next();
  });
}
