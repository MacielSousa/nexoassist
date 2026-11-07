import { inject, injectable } from "tsyringe";
import { z } from "zod";
import { CATEGORIES } from "@modules/tickets/domain/ticketRules";
import { normalize } from "@modules/tickets/domain/similarity";
import type { IArticlesRepository } from "@modules/tickets/repositories/IArticlesRepository";

export const ArticleResponseSchema = z
  .object({ code: z.string(), title: z.string(), body: z.string(), category: z.enum(CATEGORIES), score: z.number() })
  .meta({ id: "Article" });
export type IArticleResponseDTO = z.infer<typeof ArticleResponseSchema>;

/**
 * Busca por palavras-chave: tag vale 3, título 2, corpo 1. A base é pequena (dezenas de
 * artigos), então pontuar em memória é simples e suficiente; com milhares, usar full-text do Postgres.
 */
@injectable()
export class SearchArticlesUseCase {
  constructor(@inject("ArticlesRepository") private articlesRepository: IArticlesRepository) {}

  async execute(query: string, limit = 3): Promise<IArticleResponseDTO[]> {
    const terms = new Set(normalize(query));
    if (terms.size === 0) return [];
    const articles = await this.articlesRepository.listAll();
    return articles
      .map((a) => {
        const tags = new Set(a.tags.flatMap(normalize));
        const title = new Set(normalize(a.title));
        const body = new Set(normalize(a.body));
        let score = 0;
        for (const t of terms) {
          if (tags.has(t)) score += 3;
          if (title.has(t)) score += 2;
          else if (body.has(t)) score += 1;
        }
        return { code: a.code, title: a.title, body: a.body, category: a.category, score };
      })
      .filter((a) => a.score >= 3)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }
}
