import { Column, CreateDateColumn, Entity, JoinTable, ManyToMany, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { Permission } from "./Permission";

/** Conjunto nomeado de permissões. Um usuário pode ter várias roles (tabela user_roles). */
@Entity("roles")
export class Role {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  /** Identificador estável (admin, analyst, employee, suporte-n3...). */
  @Column({ type: "varchar", unique: true })
  key: string;

  @Column({ type: "varchar", unique: true })
  name: string;

  @Column({ type: "varchar", default: "" })
  description: string;

  /** Roles de sistema não podem ser apagadas (podem ter as permissões ajustadas). */
  @Column({ name: "is_system", type: "boolean", default: false })
  isSystem: boolean;

  @ManyToMany(() => Permission)
  @JoinTable({
    name: "role_permissions",
    joinColumn: { name: "role_id", referencedColumnName: "id" },
    inverseJoinColumn: { name: "permission_key", referencedColumnName: "key" },
  })
  permissions: Permission[];

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt: Date;
}
