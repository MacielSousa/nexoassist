import type { Readable } from "node:stream";

/** Onde os arquivos ficam guardados. Hoje em disco; dá para trocar por S3 sem mudar os use cases. */
export interface IStorageProvider {
  /** Salva e devolve a chave (nome interno, nunca o nome original). */
  save(content: Buffer, ext: string): Promise<string>;
  read(key: string): Promise<Readable>;
  delete(key: string): Promise<void>;
}
