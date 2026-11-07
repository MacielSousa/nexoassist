import type { DatabaseSync } from "node:sqlite";
import { addBusinessHours } from "@/domain";
import { HANDOFF_REASON_LABEL, type DraftInput, type DraftView, type HandoffInput, type HandoffReason, type MessagePart, type TurnTrace } from "@/agent/types";
import { tx } from "./db";
import type {
  ConsoleItem,
  ConversationDTO,
  ConversationSnapshot,
  ConversationStatus,
  MessageDTO,
  MessageRole,
  PublicUser,
} from "./types";

// Acesso a dados de conversas, mensagens e rascunhos.

interface ConversationRow {
  id: number;
  employee_id: string;
  status: ConversationStatus;
  assigned_analyst_id: string | null;
  handoff_reason: HandoffReason | null;
  handoff_summary: string | null;
  handoff_ticket: string | null;
  handoff_group: string | null;
  handoff_confidence: number | null;
  handoff_at: string | null;
  resolved_by: "agent" | "analyst" | null;
  created_at: string;
  updated_at: string;
  // joins
  e_name: string;
  e_department: string;
  e_initials: string;
  e_bg: string;
  e_fg: string;
  a_name: string | null;
  user_messages: number;
}

interface MessageRow {
  id: number;
  conversation_id: number;
  role: MessageRole;
  author_id: string | null;
  author_name: string | null;
  content: string;
  steps: string;
  parts: string;
  trace: string | null;
  created_at: string;
}

const CONVERSATION_SELECT = `
  SELECT c.*, e.name AS e_name, e.department AS e_department, e.initials AS e_initials,
         e.avatar_bg AS e_bg, e.avatar_fg AS e_fg, a.name AS a_name,
         (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id AND m.role = 'user') AS user_messages
  FROM conversations c
  JOIN users e ON e.id = c.employee_id
  LEFT JOIN users a ON a.id = c.assigned_analyst_id`;

/** Tempo para um analista assumir depois da transferência. */
const CONTACT_HOURS: Record<string, number> = { "Suporte N2": 2, "Suporte N1": 4 };

function toConversation(r: ConversationRow): ConversationDTO {
  const employee: PublicUser = {
    id: r.employee_id,
    name: r.e_name,
    department: r.e_department,
    initials: r.e_initials,
    avatarBg: r.e_bg,
    avatarFg: r.e_fg,
  };
  return {
    id: r.id,
    employee,
    status: r.status,
    assignedAnalyst: r.assigned_analyst_id && r.a_name ? { id: r.assigned_analyst_id, name: r.a_name } : null,
    handoff:
      r.handoff_reason && r.handoff_at
        ? {
            reason: r.handoff_reason,
            reasonLabel: HANDOFF_REASON_LABEL[r.handoff_reason],
            summary: r.handoff_summary ?? "",
            ticket: r.handoff_ticket,
            group: r.handoff_group ?? "Suporte N1",
            confidence: r.handoff_confidence,
            at: r.handoff_at,
            contactBy: addBusinessHours(new Date(r.handoff_at), CONTACT_HOURS[r.handoff_group ?? ""] ?? 4).toISOString(),
          }
        : null,
    resolvedBy: r.resolved_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    userMessageCount: r.user_messages,
  };
}

function toMessage(r: MessageRow): MessageDTO {
  return {
    id: r.id,
    role: r.role,
    author: r.author_id ? { id: r.author_id, name: r.author_name ?? r.author_id } : null,
    content: r.content,
    steps: JSON.parse(r.steps) as string[],
    parts: JSON.parse(r.parts) as MessagePart[],
    trace: r.trace ? (JSON.parse(r.trace) as TurnTrace) : null,
    createdAt: r.created_at,
  };
}

export class ConversationStore {
  constructor(
    private readonly db: DatabaseSync,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  private now() {
    return this.clock().toISOString();
  }

  get(id: number): ConversationDTO | null {
    const row = this.db.prepare(`${CONVERSATION_SELECT} WHERE c.id = ?`).get(id) as ConversationRow | undefined;
    return row ? toConversation(row) : null;
  }

  /** Conversa em andamento do funcionário; "voltar outro dia e continuar de onde parei". */
  active(employeeId: string): ConversationDTO | null {
    const row = this.db
      .prepare(`${CONVERSATION_SELECT} WHERE c.employee_id = ? AND c.status != 'closed' ORDER BY c.id DESC LIMIT 1`)
      .get(employeeId) as ConversationRow | undefined;
    return row ? toConversation(row) : null;
  }

  activeOrCreate(employeeId: string): ConversationDTO {
    const existing = this.active(employeeId);
    if (existing) return existing;
    const at = this.now();
    const { id } = this.db
      .prepare("INSERT INTO conversations (employee_id, status, created_at, updated_at) VALUES (?, 'agent', ?, ?) RETURNING id")
      .get(employeeId, at, at) as { id: number };
    return this.get(id)!;
  }

  list(): ConsoleItem[] {
    const rows = this.db
      .prepare(`${CONVERSATION_SELECT} WHERE c.status != 'closed' OR c.updated_at > ? ORDER BY c.updated_at DESC LIMIT 100`)
      .all(new Date(this.clock().getTime() - 3 * 24 * 60 * 60 * 1000).toISOString()) as unknown as ConversationRow[];
    const last = this.db.prepare(
      "SELECT role, content, created_at FROM messages WHERE conversation_id = ? AND role != 'system' ORDER BY id DESC LIMIT 1",
    );
    const unread = this.db.prepare(
      "SELECT COUNT(*) AS n FROM messages WHERE conversation_id = ? AND role = 'user' AND created_at >= ?",
    );
    return rows.map((r) => {
      const conversation = toConversation(r);
      const m = last.get(r.id) as { role: MessageRole; content: string; created_at: string } | undefined;
      const waitingSince = conversation.status === "waiting_human" ? (conversation.handoff?.at ?? r.updated_at) : null;
      return {
        conversation,
        lastMessage: m ? { role: m.role, content: m.content, createdAt: m.created_at } : null,
        // Mensagens do funcionário ainda sem resposta humana (só faz sentido aguardando atendente).
        unread: waitingSince ? Math.max(1, (unread.get(r.id, waitingSince) as { n: number }).n) : 0,
      };
    });
  }

  messages(conversationId: number, afterId = 0): MessageDTO[] {
    const rows = this.db
      .prepare(
        `SELECT m.*, u.name AS author_name FROM messages m LEFT JOIN users u ON u.id = m.author_id
         WHERE m.conversation_id = ? AND m.id > ? ORDER BY m.id`,
      )
      .all(conversationId, afterId) as unknown as MessageRow[];
    return rows.map(toMessage);
  }

  addMessage(
    conversationId: number,
    msg: { role: MessageRole; authorId?: string | null; content: string; steps?: string[]; parts?: MessagePart[]; trace?: TurnTrace | null },
  ): MessageDTO {
    const at = this.now();
    const { id } = this.db
      .prepare(
        "INSERT INTO messages (conversation_id, role, author_id, content, steps, parts, trace, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id",
      )
      .get(
        conversationId,
        msg.role,
        msg.authorId ?? null,
        msg.content,
        JSON.stringify(msg.steps ?? []),
        JSON.stringify(msg.parts ?? []),
        msg.trace ? JSON.stringify(msg.trace) : null,
        at,
      ) as { id: number };
    this.db.prepare("UPDATE conversations SET updated_at = ? WHERE id = ?").run(at, conversationId);
    return this.messages(conversationId, id - 1)[0]!;
  }

  // ---- estado da conversa (agent ↔ analista) ----

  handoff(conversationId: number, h: HandoffInput) {
    this.db
      .prepare(
        `UPDATE conversations SET status = 'waiting_human', handoff_reason = ?, handoff_summary = ?, handoff_ticket = ?,
           handoff_group = ?, handoff_confidence = ?, handoff_at = ?, assigned_analyst_id = NULL, updated_at = ?
         WHERE id = ?`,
      )
      .run(h.reason, h.summary, h.ticketNumber ?? null, h.group, h.confidence ?? null, this.now(), this.now(), conversationId);
  }

  assign(conversationId: number, analystId: string) {
    this.db
      .prepare("UPDATE conversations SET status = 'human', assigned_analyst_id = ?, updated_at = ? WHERE id = ?")
      .run(analystId, this.now(), conversationId);
  }

  returnToAgent(conversationId: number) {
    this.db
      .prepare("UPDATE conversations SET status = 'agent', assigned_analyst_id = NULL, updated_at = ? WHERE id = ?")
      .run(this.now(), conversationId);
  }

  close(conversationId: number, resolvedBy: "agent" | "analyst") {
    this.db.prepare("UPDATE conversations SET status = 'closed', resolved_by = ?, updated_at = ? WHERE id = ?").run(resolvedBy, this.now(), conversationId);
  }

  // ---- rascunhos ----

  /** Cria um rascunho e descarta os pendentes anteriores: só um card ativo por conversa. */
  createDraft(conversationId: number, employeeId: string, input: DraftInput): DraftView {
    return tx(this.db, () => {
      this.db.prepare("UPDATE drafts SET status = 'superseded' WHERE conversation_id = ? AND status = 'pending'").run(conversationId);
      const { value } = this.db.prepare("UPDATE counters SET value = value + 1 WHERE name = 'draft' RETURNING value").get() as {
        value: number;
      };
      const draft: DraftView = { ...input, id: `D-${value}`, status: "pending" };
      this.db
        .prepare("INSERT INTO drafts (id, conversation_id, employee_id, payload, status, created_at) VALUES (?, ?, ?, ?, 'pending', ?)")
        .run(draft.id, conversationId, employeeId, JSON.stringify(input), this.now());
      return draft;
    });
  }

  draft(id: string): (DraftView & { conversationId: number; employeeId: string }) | null {
    const row = this.db.prepare("SELECT * FROM drafts WHERE id = ?").get(id) as
      | { id: string; conversation_id: number; employee_id: string; payload: string; status: DraftView["status"]; result_ticket: string | null }
      | undefined;
    if (!row) return null;
    return {
      ...(JSON.parse(row.payload) as DraftInput),
      id: row.id,
      status: row.status,
      resultTicket: row.result_ticket ?? undefined,
      conversationId: row.conversation_id,
      employeeId: row.employee_id,
    };
  }

  setDraftStatus(id: string, status: DraftView["status"], resultTicket?: string) {
    this.db.prepare("UPDATE drafts SET status = ?, result_ticket = ? WHERE id = ?").run(status, resultTicket ?? null, id);
  }

  drafts(conversationId: number): Record<string, DraftView> {
    const rows = this.db.prepare("SELECT id FROM drafts WHERE conversation_id = ?").all(conversationId) as { id: string }[];
    return Object.fromEntries(
      rows.map((r) => {
        const { conversationId: _c, employeeId: _e, ...view } = this.draft(r.id)!;
        return [r.id, view];
      }),
    );
  }

  snapshot(conversationId: number): ConversationSnapshot {
    return {
      conversation: this.get(conversationId)!,
      messages: this.messages(conversationId),
      drafts: this.drafts(conversationId),
    };
  }
}
