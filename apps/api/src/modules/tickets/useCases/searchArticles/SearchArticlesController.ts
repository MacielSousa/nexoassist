import type { Request, Response } from "express";
import { container } from "tsyringe";
import { z } from "zod";
import { SearchArticlesUseCase } from "./SearchArticlesUseCase";

export class SearchArticlesController {
  static query = z.object({ q: z.string().trim().min(2).max(120).meta({ example: "vpn erro 809" }) });

  async handle(request: Request, response: Response): Promise<Response> {
    const { q } = SearchArticlesController.query.parse(request.query);
    return response.json(await container.resolve(SearchArticlesUseCase).execute(q));
  }
}
