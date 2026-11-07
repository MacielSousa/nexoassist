import type { Repository } from "typeorm";
import type { Category } from "@modules/tickets/domain/ticketRules";
import type { IArticlesRepository } from "@modules/tickets/repositories/IArticlesRepository";
import { AppDataSource } from "@shared/infra/typeorm/data-source";
import { Article } from "../entities/Article";

export class ArticlesRepository implements IArticlesRepository {
  private repository: Repository<Article>;

  constructor() {
    this.repository = AppDataSource.getRepository(Article);
  }

  create(data: { code: string; title: string; body: string; category: Category; tags: string[] }): Promise<Article> {
    return this.repository.save(this.repository.create(data));
  }

  listAll(): Promise<Article[]> {
    return this.repository.find({ order: { code: "ASC" } });
  }
}
