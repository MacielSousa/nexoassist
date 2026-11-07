/**
 * Descobre o tipo real do arquivo pelos primeiros bytes ("assinatura"), sem confiar
 * na extensão nem no Content-Type enviados pelo cliente. Só tipos da lista são aceitos.
 */

export type FileKind = "image" | "video" | "document";

export interface DetectedType {
  mime: string;
  ext: string;
  kind: FileKind;
}

const startsWith = (buf: Buffer, bytes: number[], offset = 0) => bytes.every((b, i) => buf[offset + i] === b);
const ascii = (buf: Buffer, start: number, end: number) => buf.subarray(start, end).toString("latin1");

export function detectFileType(buf: Buffer, originalName = ""): DetectedType | null {
  if (buf.length < 12) {
    return isPlainText(buf, originalName);
  }

  // Imagens
  if (startsWith(buf, [0xff, 0xd8, 0xff])) return { mime: "image/jpeg", ext: "jpg", kind: "image" };
  if (startsWith(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { mime: "image/png", ext: "png", kind: "image" };
  if (ascii(buf, 0, 6) === "GIF87a" || ascii(buf, 0, 6) === "GIF89a") return { mime: "image/gif", ext: "gif", kind: "image" };
  if (ascii(buf, 0, 4) === "RIFF" && ascii(buf, 8, 12) === "WEBP") return { mime: "image/webp", ext: "webp", kind: "image" };

  // Vídeos
  if (ascii(buf, 4, 8) === "ftyp") {
    const brand = ascii(buf, 8, 12);
    if (brand.startsWith("qt")) return { mime: "video/quicktime", ext: "mov", kind: "video" };
    return { mime: "video/mp4", ext: "mp4", kind: "video" };
  }
  if (startsWith(buf, [0x1a, 0x45, 0xdf, 0xa3])) return { mime: "video/webm", ext: "webm", kind: "video" };

  // Documentos
  if (ascii(buf, 0, 5) === "%PDF-") return { mime: "application/pdf", ext: "pdf", kind: "document" };
  if (startsWith(buf, [0x50, 0x4b, 0x03, 0x04])) {
    // Office moderno é um ZIP; o tipo vem da extensão, mas só entre os formatos Office.
    const ext = originalName.toLowerCase().split(".").pop();
    const office: Record<string, string> = {
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    };
    return ext && office[ext] ? { mime: office[ext], ext, kind: "document" } : null;
  }
  return isPlainText(buf, originalName);
}

/** .txt, .csv e .log: aceitos só se o conteúdo for texto (sem bytes nulos). */
function isPlainText(buf: Buffer, originalName: string): DetectedType | null {
  const ext = originalName.toLowerCase().split(".").pop();
  if (!ext || !["txt", "csv", "log"].includes(ext) || buf.includes(0)) return null;
  return { mime: ext === "csv" ? "text/csv" : "text/plain", ext, kind: "document" };
}

/** Limite de tamanho por tipo. */
export const MAX_BYTES: Record<FileKind, number> = {
  image: 5 * 1024 * 1024,
  video: 25 * 1024 * 1024,
  document: 10 * 1024 * 1024,
};
