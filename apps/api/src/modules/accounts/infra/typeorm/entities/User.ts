import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import type { SupportTeam } from "@modules/accounts/dtos/UserRole";
import { Role } from "./Role";
import { UserPermission } from "./UserPermission";

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

  @Column({ name: "role_id", type: "uuid" })
  roleId: string;

  /** Role com as permissões (os repositórios sempre carregam). */
  @ManyToOne(() => Role)
  @JoinColumn({ name: "role_id" })
  role: Role;

  /** Permissões concedidas direto ao usuário, além das da role. */
  @OneToMany(() => UserPermission, (p) => p.user)
  extraPermissions: UserPermission[];

  @Column({ type: "varchar" })
  department: string;

  /** Fila de atendimento (Suporte N1/N2) para quem atende no console. */
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
