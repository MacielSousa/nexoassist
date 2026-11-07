import type { Request, Response } from "express";
import { container } from "tsyringe";
import { z } from "zod";
import type { IConversationEventsProvider } from "@modules/support/providers/ConversationEventsProvider/IConversationEventsProvider";
import { ConversationSnapshot } from "@modules/support/services/ConversationSnapshot";
import { openSse } from "@shared/infra/http/sse";
import { CancelDraftUseCase } from "../cancelDraft/CancelDraftUseCase";
import { ConfirmDraftUseCase } from "../confirmDraft/ConfirmDraftUseCase";
import { StartNewConversationUseCase } from "../startNewConversation/StartNewConversationUseCase";
import { GetActiveConversationUseCase } from "./GetActiveConversationUseCase";

/** Endpoints do chat do funcionário e leitura de conversas. */
export class ConversationsController {
  static idParams = z.object({ id: z.uuid() });
  static draftParams = z.object({ id: z.string().regex(/^D-\d+$/).meta({ example: "D-381" }) });
  static eventsQuery = z.object({
    after: z.coerce.number().int().min(0).default(0).meta({ description: "Envia só mensagens com id maior" }),
    access_token: z.string().optional().meta({ description: "Alternativa ao header Authorization (EventSource não envia headers)" }),
  });

  async active(request: Request, response: Response) {
    return response.json(await container.resolve(GetActiveConversationUseCase).execute(request.user));
  }

  async startNew(request: Request, response: Response) {
    return response.status(201).json(await container.resolve(StartNewConversationUseCase).execute(request.user));
  }

  async confirmDraft(request: Request, response: Response) {
    const { id } = ConversationsController.draftParams.parse(request.params);
    return response.json(await container.resolve(ConfirmDraftUseCase).execute({ actor: request.user, draftId: id }));
  }

  async cancelDraft(request: Request, response: Response) {
    const { id } = ConversationsController.draftParams.parse(request.params);
    return response.json(await container.resolve(CancelDraftUseCase).execute({ actor: request.user, draftId: id }));
  }

  async show(request: Request, response: Response) {
    const { id } = ConversationsController.idParams.parse(request.params);
    const snapshot = container.resolve(ConversationSnapshot);
    await snapshot.findVisible(request.user, id);
    return response.json(await snapshot.build(id));
  }

  /**
   * Tempo real (SSE): a cada mudança na conversa, envia as mensagens novas e o estado atual.
   * Usado pelo funcionário (para ver o analista) e pelo console (para ver o funcionário).
   */
  async events(request: Request, response: Response) {
    const { id } = ConversationsController.idParams.parse(request.params);
    const { after } = ConversationsController.eventsQuery.parse(request.query);
    const snapshot = container.resolve(ConversationSnapshot);
    await snapshot.findVisible(request.user, id);

    const sse = openSse(response);
    let lastId = after;
    let sending = Promise.resolve();
    const push = () => {
      // Encadeia para não enviar a mesma mensagem duas vezes em eventos simultâneos.
      sending = sending.then(async () => {
        const update = await snapshot.build(id, lastId);
        lastId = update.messages.at(-1)?.id ?? lastId;
        sse.send({ type: "update", ...update });
      });
    };

    const events = container.resolve<IConversationEventsProvider>("ConversationEventsProvider");
    const unsubscribe = events.subscribe(id, push);
    const keepAlive = setInterval(() => sse.ping(), 25_000);
    response.on("close", () => {
      unsubscribe();
      clearInterval(keepAlive);
    });
    push();
  }
}
