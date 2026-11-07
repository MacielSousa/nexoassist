/**
 * Avisa quem está assistindo uma conversa (funcionário e console) que algo mudou:
 * mensagem nova, transferência, analista assumiu... O SSE escuta e envia a novidade.
 */
export interface IConversationEventsProvider {
  publish(conversationId: string): void;
  /** Retorna a função para cancelar a inscrição. */
  subscribe(conversationId: string, listener: () => void): () => void;
}
