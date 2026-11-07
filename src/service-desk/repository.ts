import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  isOpen,
  normalize,
  STATUS_LABEL,
  type Article,
  type NewTicket,
  type Ticket,
  type TicketComment,
  type TicketStatus,
} from "@/domain";
import { SEED_ARTICLES, seedTickets } from "./seed";

// Persistência do serviço de chamados simulado. Banco próprio, separado do banco do app.

interface TicketRow {
  number: string;
  type: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  requester_id: string;
  affected: string;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  assigned_group: string | null;
  comments: string;
}

function toTicket(row: TicketRow): Ticket {
  return {
    number: row.number,
    type: row.type as Ticket["type"],
    title: row.title,
    description: row.description,
    category: row.category as Ticket["category"],
    priority: row.priority as Ticket["priority"],
    status: row.status as TicketStatus,
    requesterId: row.requester_id,
    affected: row.affected as Ticket["affected"],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    resolvedAt: row.resolved_at,
    assignedGroup: row.assigned_group,
    comments: JSON.parse(row.comments) as TicketComment[],
  };
}

export class ServiceDeskRepository {
  private readonly db: DatabaseSync;

  constructor(path: string) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS tickets (
        number TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        category TEXT NOT NULL,
        priority TEXT NOT NULL,
        status TEXT NOT NULL,
        requester_id TEXT NOT NULL,
        affected TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        resolved_at TEXT,
        assigned_group TEXT,
        comments TEXT NOT NULL DEFAULT '[]',
        idempotency_key TEXT UNIQUE
      );
      CREATE INDEX IF NOT EXISTS tickets_requester ON tickets(requester_id);
      CREATE TABLE IF NOT EXISTS articles (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        category TEXT NOT NULL,
        tags TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS counters (name TEXT PRIMARY KEY, value INTEGER NOT NULL);
    `);
    this.seedIfEmpty();
  }

  private seedIfEmpty() {
    const row = this.db.prepare("SELECT COUNT(*) AS n FROM tickets").get() as { n: number };
    if (row.n > 0) return;
    for (const t of seedTickets()) this.insert(t, null);
    const insertArticle = this.db.prepare("INSERT INTO articles (id, title, body, category, tags) VALUES (?, ?, ?, ?, ?)");
    for (const a of SEED_ARTICLES) insertArticle.run(a.id, a.title, a.body, a.category, JSON.stringify(a.tags));
    this.db.prepare("INSERT INTO counters (name, value) VALUES ('INC', 20519), ('REQ', 10460)").run();
  }

  private insert(t: Ticket, idempotencyKey: string | null) {
    this.db
      .prepare(
        `INSERT INTO tickets (number, type, title, description, category, priority, status, requester_id, affected,
          created_at, updated_at, resolved_at, assigned_group, comments, idempotency_key)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        t.number,
        t.type,
        t.title,
        t.description,
        t.category,
        t.priority,
        t.status,
        t.requesterId,
        t.affected,
        t.createdAt,
        t.updatedAt,
        t.resolvedAt,
        t.assignedGroup,
        JSON.stringify(t.comments),
        idempotencyKey,
      );
  }

  private save(t: Ticket) {
    this.db
      .prepare(
        `UPDATE tickets SET status = ?, updated_at = ?, resolved_at = ?, assigned_group = ?, comments = ?, priority = ?
         WHERE number = ?`,
      )
      .run(t.status, t.updatedAt, t.resolvedAt, t.assignedGroup, JSON.stringify(t.comments), t.priority, t.number);
  }

  listByRequester(requesterId: string, scope: "open" | "all"): Ticket[] {
    const rows = this.db
      .prepare("SELECT * FROM tickets WHERE requester_id = ? ORDER BY updated_at DESC")
      .all(requesterId) as unknown as TicketRow[];
    const tickets = rows.map(toTicket);
    return scope === "open" ? tickets.filter((t) => isOpen(t.status)) : tickets;
  }

  get(number: string): Ticket | null {
    const row = this.db.prepare("SELECT * FROM tickets WHERE number = ?").get(number.toUpperCase()) as
      | TicketRow
      | undefined;
    return row ? toTicket(row) : null;
  }

  /** Idempotente: a mesma chave devolve o chamado já criado, em vez de duplicar. */
  create(requesterId: string, input: NewTicket, idempotencyKey: string, now = new Date()): Ticket {
    const existing = this.db.prepare("SELECT * FROM tickets WHERE idempotency_key = ?").get(idempotencyKey) as
      | TicketRow
      | undefined;
    if (existing) return toTicket(existing);

    const counter = this.db
      .prepare("UPDATE counters SET value = value + 1 WHERE name = ? RETURNING value")
      .get(input.type) as { value: number };
    const at = now.toISOString();
    const ticket: Ticket = {
      ...input,
      number: `${input.type}-${counter.value}`,
      status: "aberto",
      requesterId,
      createdAt: at,
      updatedAt: at,
      resolvedAt: null,
      assignedGroup: input.priority === "Crítica" ? "Plantão" : "Suporte N1",
      comments: [],
    };
    this.insert(ticket, idempotencyKey);
    return ticket;
  }

  addComment(number: string, author: string, text: string, opts: { reopen?: boolean } = {}, now = new Date()): Ticket | null {
    const t = this.get(number);
    if (!t) return null;
    const at = now.toISOString();
    t.comments.push({ at, author, text });
    t.updatedAt = at;
    if (opts.reopen) {
      t.status = "aberto";
      t.resolvedAt = null;
    } else if (t.status === "aguardando_funcionario") {
      t.status = "aberto";
    }
    this.save(t);
    return t;
  }

  transfer(number: string, group: string, summary: string, now = new Date()): Ticket | null {
    const t = this.get(number);
    if (!t) return null;
    const at = now.toISOString();
    t.status = "aguardando_analista";
    t.assignedGroup = group;
    t.updatedAt = at;
    t.comments.push({ at, author: "Nexo Assist", text: `Transferido para ${group}. ${summary}` });
    this.save(t);
    return t;
  }

  setStatus(number: string, status: TicketStatus, author: string, now = new Date()): Ticket | null {
    const t = this.get(number);
    if (!t) return null;
    const at = now.toISOString();
    t.status = status;
    t.updatedAt = at;
    t.resolvedAt = status === "resolvido" || status === "fechado" ? at : null;
    t.comments.push({ at, author, text: `Status alterado para "${STATUS_LABEL[status]}".` });
    this.save(t);
    return t;
  }

  searchArticles(query: string, limit = 3): (Article & { score: number })[] {
    const terms = new Set(normalize(query));
    if (terms.size === 0) return [];
    const rows = this.db.prepare("SELECT * FROM articles").all() as unknown as {
      id: string;
      title: string;
      body: string;
      category: string;
      tags: string;
    }[];
    return rows
      .map((r) => {
        const tags = JSON.parse(r.tags) as string[];
        const tagTerms = new Set(tags.flatMap((tag) => normalize(tag)));
        const titleTerms = new Set(normalize(r.title));
        const bodyTerms = new Set(normalize(r.body));
        let score = 0;
        for (const term of terms) {
          if (tagTerms.has(term)) score += 3;
          if (titleTerms.has(term)) score += 2;
          else if (bodyTerms.has(term)) score += 1;
        }
        return { id: r.id, title: r.title, body: r.body, category: r.category as Article["category"], tags, score };
      })
      .filter((a) => a.score >= 3)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  close() {
    this.db.close();
  }
}
