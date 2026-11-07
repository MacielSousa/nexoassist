import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from "typeorm";
import type { ITurnTrace, MessagePart, MessageRole } from "@modules/support/dtos/supportTypes";

@Entity("messages")
export class Message {
  /** Sequencial: o tempo real envia "mensagens com id maior que X". */
  @PrimaryGeneratedColumn("increment")
  id: number;

  @Column({ name: "conversation_id", type: "uuid" })
  conversationId: string;

  @Column({ type: "varchar" })
  role: MessageRole;

  @Column({ name: "author_id", type: "uuid", nullable: true })
  authorId: string | null;

  @Column({ name: "author_name", type: "varchar", nullable: true })
  authorName: string | null;

  @Column({ type: "text" })
  content: string;

  /** Ações do agent nesta resposta ("consultou seus chamados"...). */
  @Column({ type: "jsonb", default: () => "'[]'" })
  steps: string[];

  /** Cards mostrados junto (rascunho, chamado, opções...). */
  @Column({ type: "jsonb", default: () => "'[]'" })
  parts: MessagePart[];

  /** "Como decidi": intenção, confiança, tools, tokens e latência. */
  @Column({ type: "jsonb", nullable: true })
  trace: ITurnTrace | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt: Date;
}
