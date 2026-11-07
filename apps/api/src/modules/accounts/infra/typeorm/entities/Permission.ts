import { Column, Entity, PrimaryColumn } from "typeorm";

/** Permissão do catálogo (ver dtos/permissions.ts). */
@Entity("permissions")
export class Permission {
  @PrimaryColumn({ type: "varchar" })
  key: string;

  @Column({ type: "varchar" })
  group: string;

  @Column({ type: "varchar" })
  description: string;
}
