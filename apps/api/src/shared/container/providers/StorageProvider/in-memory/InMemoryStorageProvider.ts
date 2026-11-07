import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import type { IStorageProvider } from "../IStorageProvider";

export class InMemoryStorageProvider implements IStorageProvider {
  files = new Map<string, Buffer>();

  async save(content: Buffer, ext: string) {
    const key = `${randomUUID()}.${ext}`;
    this.files.set(key, content);
    return key;
  }

  async read(key: string) {
    return Readable.from(this.files.get(key) ?? Buffer.alloc(0));
  }

  async delete(key: string) {
    this.files.delete(key);
  }
}
