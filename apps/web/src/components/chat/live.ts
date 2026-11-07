"use client";

import { useEffect, useRef } from "react";
import type { ConversationSnapshot, Message } from "@/lib/types";

/** Junta mensagens por id (as atualizações podem chegar repetidas ou fora de ordem). */
export function mergeSnapshot(current: ConversationSnapshot, update: Partial<ConversationSnapshot>): ConversationSnapshot {
  const byId = new Map<number, Message>(current.messages.map((m) => [m.id, m]));
  for (const m of update.messages ?? []) byId.set(m.id, m);
  return {
    conversation: update.conversation ?? current.conversation,
    messages: [...byId.values()].sort((a, b) => a.id - b.id),
    drafts: update.drafts ? { ...current.drafts, ...update.drafts } : current.drafts,
  };
}

/** Assina as atualizações em tempo real de uma conversa (SSE com reconexão automática do navegador). */
export function useLiveConversation(
  conversationId: string | null,
  lastId: number,
  onUpdate: (update: Partial<ConversationSnapshot>) => void,
) {
  const handler = useRef(onUpdate);
  const after = useRef(lastId);
  useEffect(() => {
    handler.current = onUpdate;
    after.current = lastId;
  });

  useEffect(() => {
    if (conversationId === null) return;
    const source = new EventSource(`/api/conversations/${conversationId}/events?after=${after.current}`);
    source.onmessage = (e) => {
      const data = JSON.parse(e.data as string) as { type: string } & Partial<ConversationSnapshot>;
      if (data.type === "update") handler.current(data);
    };
    return () => source.close();
  }, [conversationId]);
}

/** Lê um corpo SSE de um fetch (POST não funciona com EventSource). */
export async function readSse<T>(res: Response, onEvent: (event: T) => void) {
  const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += value;
    let idx: number;
    while ((idx = buffer.indexOf("\n\n")) >= 0) {
      const chunk = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      const line = chunk.split("\n").find((l) => l.startsWith("data: "));
      if (line) onEvent(JSON.parse(line.slice(6)) as T);
    }
  }
}

export async function postJson<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string; message?: string };
  if (!res.ok) throw new Error(data.message ?? data.error ?? "Algo deu errado. Tente de novo.");
  return data;
}
