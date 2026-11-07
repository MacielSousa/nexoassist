import { Column, CreateDateColumn, Entity, PrimaryColumn } from "typeorm";
import type { DraftStatus, IDraftPayload } from "@modules/support/dtos/supportTypes";

/** Rascunho de chamado (ou de atualização) aguardando a confirmação do funcionário. */
@Entity("drafts")
export class Draft {
  /** Legível: D-381. Também é a chave de idempotência na criação do chamado. */
  @PrimaryColumn({ type: "varchar" })
  id: string;

  @Column({ name: "conversation_id", type: "uuid" })
  conversationId: string;

  @Column({ name: "employee_id", type: "uuid" })
  employeeId: string;

  @Column({ type: "jsonb" })
  payload: IDraftPayload;

  @Column({ type: "varchar" })
  status: DraftStatus;

  @Column({ name: "result_ticket", type: "varchar", nullable: true })
  resultTicket: string | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt: Date;
}
