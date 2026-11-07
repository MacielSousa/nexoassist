import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import type { SupportTeam } from "@modules/accounts/dtos/UserRole";
import { User } from "@modules/accounts/infra/typeorm/entities/User";
import type { ConversationStatus, HandoffReason } from "@modules/support/dtos/supportTypes";

@Entity("conversations")
export class Conversation {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "employee_id", type: "uuid" })
  employeeId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: "employee_id" })
  employee: User;

  @Column({ type: "varchar" })
  status: ConversationStatus;

  @Column({ name: "assigned_analyst_id", type: "uuid", nullable: true })
  assignedAnalystId: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: "assigned_analyst_id" })
  assignedAnalyst: User | null;

  // ---- Transferência para analista (preenchido quando o agent passa a conversa) ----

  @Column({ name: "handoff_reason", type: "varchar", nullable: true })
  handoffReason: HandoffReason | null;

  @Column({ name: "handoff_summary", type: "text", nullable: true })
  handoffSummary: string | null;

  @Column({ name: "handoff_ticket", type: "varchar", nullable: true })
  handoffTicket: string | null;

  @Column({ name: "handoff_group", type: "varchar", nullable: true })
  handoffGroup: SupportTeam | null;

  @Column({ name: "handoff_confidence", type: "real", nullable: true })
  handoffConfidence: number | null;

  @Column({ name: "handoff_at", type: "timestamptz", nullable: true })
  handoffAt: Date | null;

  @Column({ name: "resolved_by", type: "varchar", nullable: true })
  resolvedBy: "agent" | "analyst" | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt: Date;
}
