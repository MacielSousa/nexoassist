import { randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Readable } from "node:stream";
import type { IStorageProvider } from "../IStorageProvider";

/** Guarda em disco (UPLOADS_DIR). No Docker é um volume, então os arquivos sobrevivem a reinícios. */
export class DiskStorageProvider implements IStorageProvider {
  private dir = process.env.UPLOADS_DIR ?? join(process.cwd(), "uploads");

  async save(content: Buffer, ext: string): Promise<string> {
    await mkdir(this.dir, { recursive: true });
    // Nome aleatório: o nome enviado pelo usuário nunca vira caminho no disco.
    const key = `${randomUUID()}.${ext.replace(/[^a-z0-9]/gi, "")}`;
    await writeFile(join(this.dir, key), content, { flag: "wx" });
    return key;
  }

  async read(key: string): Promise<Readable> {
    return createReadStream(join(this.dir, this.safe(key)));
  }

  async delete(key: string): Promise<void> {
    await rm(join(this.dir, this.safe(key)), { force: true });
  }

  /** Defesa extra contra "../": a chave só pode ter o formato que nós mesmos geramos. */
  private safe(key: string) {
    if (!/^[0-9a-f-]{36}\.[a-z0-9]+$/i.test(key)) throw new Error("Chave de arquivo inválida.");
    return key;
  }
}
