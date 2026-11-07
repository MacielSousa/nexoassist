import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Ticket } from "./Ticket";

/** Histórico do chamado: comentários de funcionário, analista, agent e mudanças de status. */
@Entity("ticket_comments")
export class TicketComment {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "ticket_id", type: "uuid" })
  ticketId: string;

  @ManyToOne(() => Ticket, (ticket) => ticket.comments, { onDelete: "CASCADE" })
  @JoinColumn({ name: "ticket_id" })
  ticket: Ticket;

  /** Nulo quando o autor é o Nexo Assist ou o sistema. */
  @Column({ name: "author_id", type: "uuid", nullable: true })
  authorId: string | null;

  @Column({ name: "author_name", type: "varchar" })
  authorName: string;

  @Column({ type: "text" })
  body: string;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt: Date;
}
