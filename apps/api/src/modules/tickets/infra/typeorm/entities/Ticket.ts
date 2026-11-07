import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { User } from "@modules/accounts/infra/typeorm/entities/User";
import type { Affected, Category, Priority, TicketStatus, TicketType } from "@modules/tickets/domain/ticketRules";
import { TicketComment } from "./TicketComment";

@Entity("tickets")
export class Ticket {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  /** Número visível ao usuário: INC-20311, REQ-10442. */
  @Column({ type: "varchar", unique: true })
  number: string;

  @Column({ type: "varchar" })
  type: TicketType;

  @Column({ type: "varchar" })
  title: string;

  @Column({ type: "text" })
  description: string;

  @Column({ type: "varchar" })
  category: Category;

  @Column({ type: "varchar" })
  priority: Priority;

  /** Por que essa prioridade (regra do Anexo A aplicada). */
  @Column({ name: "priority_reason", type: "varchar" })
  priorityReason: string;

  @Column({ type: "varchar" })
  status: TicketStatus;

  @Column({ type: "varchar" })
  affected: Affected;

  @Column({ name: "requester_id", type: "uuid" })
  requesterId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: "requester_id" })
  requester: User;

  @Column({ name: "assigned_group", type: "varchar", nullable: true })
  assignedGroup: string | null;

  @Column({ name: "assigned_analyst_id", type: "uuid", nullable: true })
  assignedAnalystId: string | null;

  @Column({ name: "resolved_at", type: "timestamptz", nullable: true })
  resolvedAt: Date | null;

  /** Garante que confirmar o mesmo rascunho duas vezes não crie dois chamados. */
  @Column({ name: "idempotency_key", type: "varchar", nullable: true, unique: true })
  idempotencyKey: string | null;

  @OneToMany(() => TicketComment, (comment) => comment.ticket)
  comments: TicketComment[];

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt: Date;
}
