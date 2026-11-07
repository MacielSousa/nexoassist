import { randomUUID } from "node:crypto";
import type { Category } from "@modules/tickets/domain/ticketRules";
import { Article } from "@modules/tickets/infra/typeorm/entities/Article";
import type { IArticlesRepository } from "../IArticlesRepository";

export class ArticlesRepositoryInMemory implements IArticlesRepository {
  articles: Article[] = [];

  async create(data: { code: string; title: string; body: string; category: Category; tags: string[] }) {
    const article = Object.assign(new Article(), { ...data, id: randomUUID(), createdAt: new Date() });
    this.articles.push(article);
    return article;
  }

  async listAll() {
    return [...this.articles];
  }
}
