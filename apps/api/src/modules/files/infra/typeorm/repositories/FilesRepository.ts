import { In, type Repository } from "typeorm";
import type { ICreateFileDTO, IFilesRepository } from "@modules/files/repositories/IFilesRepository";
import { AppDataSource } from "@shared/infra/typeorm/data-source";
import { StoredFile } from "../entities/StoredFile";

export class FilesRepository implements IFilesRepository {
  private repository: Repository<StoredFile>;

  constructor() {
    this.repository = AppDataSource.getRepository(StoredFile);
  }

  create(data: ICreateFileDTO): Promise<StoredFile> {
    return this.repository.save(this.repository.create(data));
  }

  findById(id: string): Promise<StoredFile | null> {
    return this.repository.findOneBy({ id });
  }

  findByIds(ids: string[]): Promise<StoredFile[]> {
    return ids.length ? this.repository.findBy({ id: In(ids) }) : Promise.resolve([]);
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }
}
