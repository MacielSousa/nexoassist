import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from "typeorm";

export type FilePurpose = "avatar" | "attachment";

/** Metadados de um arquivo enviado. O conteúdo fica no StorageProvider (disco/S3). */
@Entity("files")
export class StoredFile {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  /** Quem enviou. */
  @Column({ name: "owner_id", type: "uuid" })
  ownerId: string;

  @Column({ type: "varchar" })
  purpose: FilePurpose;

  /** Para anexos: a conversa onde foi enviado (define quem pode baixar). */
  @Column({ name: "conversation_id", type: "uuid", nullable: true })
  conversationId: string | null;

  @Column({ name: "original_name", type: "varchar" })
  originalName: string;

  @Column({ type: "varchar" })
  mime: string;

  @Column({ type: "integer" })
  size: number;

  @Column({ name: "storage_key", type: "varchar", unique: true })
  storageKey: string;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt: Date;
}
