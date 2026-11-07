import type { DraftView, HandoffReason, MessagePart, TurnTrace } from "@/agent/types";

// DTOs trocados entre servidor e interface.

export type ConversationStatus = "agent" | "waiting_human" | "human" | "closed";
export type MessageRole = "user" | "assistant" | "analyst" | "system";

export const MESSAGE_LIMIT = 30;

export interface PublicUser {
  id: string;
  name: string;
  department: string;
  initials: string;
  avatarBg: string;
  avatarFg: string;
}

export interface HandoffDTO {
  reason: HandoffReason;
  reasonLabel: string;
  summary: string;
  ticket: string | null;
  group: string;
  confidence: number | null;
  at: string;
  /** Prazo para um analista assumir (agent pausado até lá). */
  contactBy: string;
}

export interface ConversationDTO {
  id: number;
  employee: PublicUser;
  status: ConversationStatus;
  assignedAnalyst: { id: string; name: string } | null;
  handoff: HandoffDTO | null;
  resolvedBy: "agent" | "analyst" | null;
  createdAt: string;
  updatedAt: string;
  userMessageCount: number;
}

export interface MessageDTO {
  id: number;
  role: MessageRole;
  author: { id: string; name: string } | null;
  content: string;
  steps: string[];
  parts: MessagePart[];
  trace: TurnTrace | null;
  createdAt: string;
}

export interface ConversationSnapshot {
  conversation: ConversationDTO;
  messages: MessageDTO[];
  drafts: Record<string, DraftView>;
}

export interface ConsoleItem {
  conversation: ConversationDTO;
  lastMessage: Pick<MessageDTO, "role" | "content" | "createdAt"> | null;
  unread: number;
}

/** Eventos do streaming da resposta do agent (POST /api/chat). */
export type ChatStreamEvent =
  | { type: "user"; message: MessageDTO }
  | { type: "steps"; steps: string[] }
  | { type: "text"; delta: string }
  | { type: "text-reset" }
  | { type: "done"; snapshot: ConversationSnapshot }
  | { type: "error"; error: string };
