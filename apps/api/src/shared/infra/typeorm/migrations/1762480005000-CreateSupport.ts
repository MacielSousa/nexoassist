import type { MigrationInterface, QueryRunner } from "typeorm";

export class CreateSupport1762480005000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE conversations (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        employee_id uuid NOT NULL REFERENCES users(id),
        status varchar NOT NULL CHECK (status IN ('agent', 'waiting_human', 'human', 'closed')),
        assigned_analyst_id uuid REFERENCES users(id),
        handoff_reason varchar,
        handoff_summary text,
        handoff_ticket varchar,
        handoff_group varchar,
        handoff_confidence real,
        handoff_at timestamptz,
        resolved_by varchar,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    // No máximo uma conversa em andamento por funcionário.
    await queryRunner.query(`CREATE UNIQUE INDEX conversations_one_active_idx ON conversations (employee_id) WHERE status <> 'closed'`);
    await queryRunner.query(`CREATE INDEX conversations_status_idx ON conversations (status, updated_at DESC)`);

    await queryRunner.query(`
      CREATE TABLE messages (
        id serial PRIMARY KEY,
        conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        role varchar NOT NULL CHECK (role IN ('user', 'assistant', 'analyst', 'system')),
        author_id uuid REFERENCES users(id),
        author_name varchar,
        content text NOT NULL,
        steps jsonb NOT NULL DEFAULT '[]',
        parts jsonb NOT NULL DEFAULT '[]',
        trace jsonb,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE INDEX messages_conversation_idx ON messages (conversation_id, id)`);

    await queryRunner.query(`CREATE SEQUENCE draft_seq START 381`);
    await queryRunner.query(`
      CREATE TABLE drafts (
        id varchar PRIMARY KEY,
        conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        employee_id uuid NOT NULL REFERENCES users(id),
        payload jsonb NOT NULL,
        status varchar NOT NULL,
        result_ticket varchar,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE INDEX drafts_conversation_idx ON drafts (conversation_id)`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE drafts`);
    await queryRunner.query(`DROP SEQUENCE draft_seq`);
    await queryRunner.query(`DROP TABLE messages`);
    await queryRunner.query(`DROP TABLE conversations`);
  }
}
