import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import type { SupportTeam, UserRole } from "@modules/accounts/dtos/UserRole";

@Entity("users")
export class User {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar" })
  name: string;

  @Column({ type: "varchar", unique: true })
  email: string;

  /** Hash bcrypt. Nunca sai da API (ver UserMap). */
  @Column({ type: "varchar" })
  password: string;

  @Column({ type: "varchar" })
  role: UserRole;

  @Column({ type: "varchar" })
  department: string;

  /** Fila do analista (Suporte N1/N2). Nulo para funcionários e admins. */
  @Column({ type: "varchar", nullable: true })
  team: SupportTeam | null;

  @Column({ type: "boolean", default: true })
  active: boolean;

  /** Foto de perfil (tabela files). */
  @Column({ name: "avatar_file_id", type: "uuid", nullable: true })
  avatarFileId: string | null;

  @Column({ name: "password_changed_at", type: "timestamptz" })
  passwordChangedAt: Date;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt: Date;
}
