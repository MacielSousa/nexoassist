import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { seedApp } from "./seed";

// Banco do app: usuários, conversas, mensagens e rascunhos. Separado do banco do serviço de chamados.

const SCHEMA = `
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('employee', 'analyst')),
    department TEXT NOT NULL,
    initials TEXT NOT NULL,
    avatar_bg TEXT NOT NULL,
    avatar_fg TEXT NOT NULL,
    password_changed_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id TEXT NOT NULL REFERENCES users(id),
    status TEXT NOT NULL CHECK (status IN ('agent', 'waiting_human', 'human', 'closed')),
    assigned_analyst_id TEXT REFERENCES users(id),
    handoff_reason TEXT,
    handoff_summary TEXT,
    handoff_ticket TEXT,
    handoff_group TEXT,
    handoff_confidence REAL,
    handoff_at TEXT,
    resolved_by TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS conversations_employee ON conversations(employee_id, status);
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER NOT NULL REFERENCES conversations(id),
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'analyst', 'system')),
    author_id TEXT,
    content TEXT NOT NULL,
    steps TEXT NOT NULL DEFAULT '[]',
    parts TEXT NOT NULL DEFAULT '[]',
    trace TEXT,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS messages_conversation ON messages(conversation_id, id);
  CREATE TABLE IF NOT EXISTS drafts (
    id TEXT PRIMARY KEY,
    conversation_id INTEGER NOT NULL REFERENCES conversations(id),
    employee_id TEXT NOT NULL REFERENCES users(id),
    payload TEXT NOT NULL,
    status TEXT NOT NULL,
    result_ticket TEXT,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS counters (name TEXT PRIMARY KEY, value INTEGER NOT NULL);
`;

export function openAppDb(path: string): DatabaseSync {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(SCHEMA);
  const { n } = db.prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number };
  if (n === 0) seedApp(db);
  return db;
}

const g = globalThis as unknown as { __appDb?: DatabaseSync };

export function appDb(): DatabaseSync {
  g.__appDb ??= openAppDb(process.env.APP_DB ?? join(process.cwd(), "data", "app.db"));
  return g.__appDb;
}

/** Executa em transação (o node:sqlite é síncrono, então isso é atômico dentro do processo). */
export function tx<T>(db: DatabaseSync, fn: () => T): T {
  db.exec("BEGIN");
  try {
    const out = fn();
    db.exec("COMMIT");
    return out;
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}
