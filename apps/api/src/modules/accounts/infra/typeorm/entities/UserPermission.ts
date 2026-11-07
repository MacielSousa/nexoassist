import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryColumn } from "typeorm";
import { User } from "./User";

/** Permissão concedida direto a um usuário, além das da role dele. */
@Entity("user_permissions")
export class UserPermission {
  @PrimaryColumn({ name: "user_id", type: "uuid" })
  userId: string;

  @PrimaryColumn({ name: "permission_key", type: "varchar" })
  permissionKey: string;

  @ManyToOne(() => User, (user) => user.extraPermissions, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user: User;

  /** Admin que concedeu. */
  @Column({ name: "granted_by_id", type: "uuid", nullable: true })
  grantedById: string | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt: Date;
}
