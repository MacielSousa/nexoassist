import type { Category } from "../domain/ticketRules";
import type { Article } from "../infra/typeorm/entities/Article";

export interface IArticlesRepository {
  create(data: { code: string; title: string; body: string; category: Category; tags: string[] }): Promise<Article>;
  listAll(): Promise<Article[]>;
}
