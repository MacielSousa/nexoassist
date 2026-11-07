import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Rastreia quem atendeu e quando, para os relatórios:
 * - conversations.handled_by_id / taken_at: último analista que assumiu (não é apagado ao devolver ao agent);
 * - conversations.closed_at / closed_by_id: encerramento;
 * - tickets.resolved_by_id: analista que resolveu/fechou o chamado.
 */
export class AddAttendanceTracking1762480006000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE conversations
        ADD COLUMN handled_by_id uuid REFERENCES users(id),
        ADD COLUMN taken_at timestamptz,
        ADD COLUMN closed_at timestamptz,
        ADD COLUMN closed_by_id uuid REFERENCES users(id)
    `);
    await queryRunner.query(`ALTER TABLE tickets ADD COLUMN resolved_by_id uuid REFERENCES users(id)`);
    await queryRunner.query(`CREATE INDEX conversations_created_idx ON conversations (created_at)`);
    await queryRunner.query(`CREATE INDEX tickets_created_idx ON tickets (created_at)`);
    await queryRunner.query(`CREATE INDEX tickets_resolved_idx ON tickets (resolved_at)`);

    // Dados existentes: quem está atendendo agora conta como quem assumiu; encerradas ganham data.
    await queryRunner.query(`UPDATE conversations SET handled_by_id = assigned_analyst_id, taken_at = updated_at WHERE assigned_analyst_id IS NOT NULL`);
    await queryRunner.query(`UPDATE conversations SET closed_at = updated_at WHERE status = 'closed'`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX tickets_resolved_idx`);
    await queryRunner.query(`DROP INDEX tickets_created_idx`);
    await queryRunner.query(`DROP INDEX conversations_created_idx`);
    await queryRunner.query(`ALTER TABLE tickets DROP COLUMN resolved_by_id`);
    await queryRunner.query(`ALTER TABLE conversations DROP COLUMN closed_by_id, DROP COLUMN closed_at, DROP COLUMN taken_at, DROP COLUMN handled_by_id`);
  }
}
