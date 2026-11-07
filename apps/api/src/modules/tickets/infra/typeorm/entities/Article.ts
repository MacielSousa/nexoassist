import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from "typeorm";
import type { Category } from "@modules/tickets/domain/ticketRules";

/** Artigo da central de ajuda (autoatendimento). */
@Entity("articles")
export class Article {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  /** Código legível: KB-001. */
  @Column({ type: "varchar", unique: true })
  code: string;

  @Column({ type: "varchar" })
  title: string;

  @Column({ type: "text" })
  body: string;

  @Column({ type: "varchar" })
  category: Category;

  @Column({ type: "text", array: true, default: () => "'{}'" })
  tags: string[];

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt: Date;
}
