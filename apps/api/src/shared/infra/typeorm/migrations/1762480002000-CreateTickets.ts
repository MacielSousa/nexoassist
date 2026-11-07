import type { MigrationInterface, QueryRunner } from "typeorm";

export class CreateTickets1762480002000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    // Numeração continua a do sistema legado (INC-20520..., REQ-10461...).
    await queryRunner.query(`CREATE SEQUENCE ticket_inc_seq START 20520`);
    await queryRunner.query(`CREATE SEQUENCE ticket_req_seq START 10461`);
    await queryRunner.query(`
      CREATE TABLE tickets (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        number varchar NOT NULL UNIQUE,
        type varchar NOT NULL CHECK (type IN ('INC', 'REQ')),
        title varchar NOT NULL,
        description text NOT NULL,
        category varchar NOT NULL,
        priority varchar NOT NULL CHECK (priority IN ('Crítica', 'Alta', 'Média', 'Baixa')),
        priority_reason varchar NOT NULL DEFAULT '',
        status varchar NOT NULL,
        affected varchar NOT NULL CHECK (affected IN ('individual', 'equipe', 'empresa')),
        requester_id uuid NOT NULL REFERENCES users(id),
        assigned_group varchar,
        assigned_analyst_id uuid REFERENCES users(id),
        resolved_at timestamptz,
        idempotency_key varchar UNIQUE,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE INDEX tickets_requester_idx ON tickets (requester_id, updated_at DESC)`);
    await queryRunner.query(`CREATE INDEX tickets_status_idx ON tickets (status)`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE tickets`);
    await queryRunner.query(`DROP SEQUENCE ticket_req_seq`);
    await queryRunner.query(`DROP SEQUENCE ticket_inc_seq`);
  }
}
