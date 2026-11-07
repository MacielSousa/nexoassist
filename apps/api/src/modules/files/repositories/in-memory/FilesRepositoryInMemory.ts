import { randomUUID } from "node:crypto";
import { StoredFile } from "@modules/files/infra/typeorm/entities/StoredFile";
import type { ICreateFileDTO, IFilesRepository } from "../IFilesRepository";

export class FilesRepositoryInMemory implements IFilesRepository {
  files: StoredFile[] = [];

  async create(data: ICreateFileDTO) {
    const file = Object.assign(new StoredFile(), { ...data, id: randomUUID(), createdAt: new Date() });
    this.files.push(file);
    return file;
  }

  async findById(id: string) {
    return this.files.find((f) => f.id === id) ?? null;
  }

  async findByIds(ids: string[]) {
    return this.files.filter((f) => ids.includes(f.id));
  }

  async delete(id: string) {
    this.files = this.files.filter((f) => f.id !== id);
  }
}
