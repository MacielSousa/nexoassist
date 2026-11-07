import type { FilePurpose, StoredFile } from "../infra/typeorm/entities/StoredFile";

export interface ICreateFileDTO {
  ownerId: string;
  purpose: FilePurpose;
  conversationId: string | null;
  originalName: string;
  mime: string;
  size: number;
  storageKey: string;
}

export interface IFilesRepository {
  create(data: ICreateFileDTO): Promise<StoredFile>;
  findById(id: string): Promise<StoredFile | null>;
  findByIds(ids: string[]): Promise<StoredFile[]>;
  delete(id: string): Promise<void>;
}
