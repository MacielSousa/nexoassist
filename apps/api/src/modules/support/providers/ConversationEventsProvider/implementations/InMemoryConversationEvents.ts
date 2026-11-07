import { EventEmitter } from "node:events";
import type { IConversationEventsProvider } from "../IConversationEventsProvider";

/**
 * Pub/sub em memória: funciona com uma instância da API. Para escalar horizontalmente,
 * trocar por Redis pub/sub ou LISTEN/NOTIFY do Postgres implementando a mesma interface.
 */
export class InMemoryConversationEvents implements IConversationEventsProvider {
  private emitter = new EventEmitter().setMaxListeners(0);

  publish(conversationId: string) {
    this.emitter.emit(conversationId);
  }

  subscribe(conversationId: string, listener: () => void) {
    this.emitter.on(conversationId, listener);
    return () => {
      this.emitter.off(conversationId, listener);
    };
  }
}
