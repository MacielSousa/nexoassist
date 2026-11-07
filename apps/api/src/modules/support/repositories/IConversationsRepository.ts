import type { Conversation } from "../infra/typeorm/entities/Conversation";

export interface IConversationsRepository {
  create(employeeId: string): Promise<Conversation>;
  /** Com employee e assignedAnalyst carregados. */
  findById(id: string): Promise<Conversation | null>;
  /** A conversa em andamento (não encerrada) do funcionário. */
  findActiveByEmployee(employeeId: string): Promise<Conversation | null>;
  /** Conversas para o console: em andamento ou encerradas desde `closedSince`. */
  listForConsole(closedSince: Date): Promise<Conversation[]>;
  save(conversation: Conversation): Promise<Conversation>;
  /** Marca atividade (updated_at = agora). */
  touch(id: string): Promise<void>;
}
