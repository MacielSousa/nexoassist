import { randomUUID } from "node:crypto";
import type { User } from "@modules/accounts/infra/typeorm/entities/User";
import type { DraftStatus, IDraftPayload } from "@modules/support/dtos/supportTypes";
import { Conversation } from "@modules/support/infra/typeorm/entities/Conversation";
import { Draft } from "@modules/support/infra/typeorm/entities/Draft";
import { Message } from "@modules/support/infra/typeorm/entities/Message";
import type { IConversationsRepository } from "../IConversationsRepository";
import type { IDraftsRepository } from "../IDraftsRepository";
import type { ICreateMessageDTO, IMessagesRepository } from "../IMessagesRepository";

/** Versões em memória dos repositórios de atendimento, para testes de use case. */
export class ConversationsRepositoryInMemory implements IConversationsRepository {
  conversations: Conversation[] = [];

  /** Para preencher as relações como o TypeORM faria. */
  constructor(private findUser: (id: string) => User | undefined) {}

  private hydrate(c: Conversation) {
    c.employee = this.findUser(c.employeeId)!;
    c.assignedAnalyst = c.assignedAnalystId ? (this.findUser(c.assignedAnalystId) ?? null) : null;
    return c;
  }

  async create(employeeId: string) {
    const now = new Date();
    const c = Object.assign(new Conversation(), {
      id: randomUUID(), employeeId, status: "agent", assignedAnalystId: null, handoffReason: null, handoffSummary: null,
      handoffTicket: null, handoffGroup: null, handoffConfidence: null, handoffAt: null, resolvedBy: null, createdAt: now, updatedAt: now,
    });
    this.conversations.push(c);
    return this.hydrate(c);
  }

  async findById(id: string) {
    const c = this.conversations.find((x) => x.id === id);
    return c ? this.hydrate(c) : null;
  }

  async findActiveByEmployee(employeeId: string) {
    const c = this.conversations.find((x) => x.employeeId === employeeId && x.status !== "closed");
    return c ? this.hydrate(c) : null;
  }

  async listForConsole(closedSince: Date) {
    return this.conversations.filter((c) => c.status !== "closed" || c.updatedAt > closedSince).map((c) => this.hydrate(c));
  }

  async save(c: Conversation) {
    c.updatedAt = new Date();
    return this.hydrate(c);
  }

  async touch(id: string) {
    const c = this.conversations.find((x) => x.id === id);
    if (c) c.updatedAt = new Date();
  }
}

export class MessagesRepositoryInMemory implements IMessagesRepository {
  messages: Message[] = [];
  private seq = 0;

  async create(data: ICreateMessageDTO) {
    const m = Object.assign(new Message(), {
      authorId: null, authorName: null, steps: [], parts: [], trace: null, ...data, id: ++this.seq, createdAt: new Date(),
    });
    this.messages.push(m);
    return m;
  }

  async listByConversation(conversationId: string, afterId = 0) {
    return this.messages.filter((m) => m.conversationId === conversationId && m.id > afterId);
  }

  async countUserMessages(conversationId: string, since?: Date) {
    return this.messages.filter((m) => m.conversationId === conversationId && m.role === "user" && (!since || m.createdAt >= since)).length;
  }

  async lastVisibleByConversation(ids: string[]) {
    const map = new Map<string, Message>();
    for (const m of this.messages) if (ids.includes(m.conversationId) && m.role !== "system") map.set(m.conversationId, m);
    return map;
  }
}

export class DraftsRepositoryInMemory implements IDraftsRepository {
  drafts: Draft[] = [];
  private seq = 380;

  async create(data: { conversationId: string; employeeId: string; payload: IDraftPayload }) {
    for (const d of this.drafts) if (d.conversationId === data.conversationId && d.status === "pending") d.status = "superseded";
    const d = Object.assign(new Draft(), { ...data, id: `D-${++this.seq}`, status: "pending", resultTicket: null, createdAt: new Date() });
    this.drafts.push(d);
    return d;
  }

  async findById(id: string) {
    return this.drafts.find((d) => d.id === id) ?? null;
  }

  async listByConversation(conversationId: string) {
    return this.drafts.filter((d) => d.conversationId === conversationId);
  }

  async updateStatus(id: string, status: DraftStatus, resultTicket?: string) {
    const d = this.drafts.find((x) => x.id === id);
    if (d) Object.assign(d, { status, resultTicket: resultTicket ?? null });
  }
}
