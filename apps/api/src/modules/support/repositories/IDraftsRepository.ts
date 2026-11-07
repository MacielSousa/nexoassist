import type { DraftStatus, IDraftPayload } from "../dtos/supportTypes";
import type { Draft } from "../infra/typeorm/entities/Draft";

export interface IDraftsRepository {
  /** Cria um rascunho e marca os pendentes da conversa como substituídos: só um card ativo. */
  create(data: { conversationId: string; employeeId: string; payload: IDraftPayload }): Promise<Draft>;
  findById(id: string): Promise<Draft | null>;
  listByConversation(conversationId: string): Promise<Draft[]>;
  updateStatus(id: string, status: DraftStatus, resultTicket?: string): Promise<void>;
}
