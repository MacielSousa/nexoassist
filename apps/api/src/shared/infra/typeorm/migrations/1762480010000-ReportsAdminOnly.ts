import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Relatórios passam a ser só do Admin: a role de sistema "analyst" deixa de ter reports.view.
 * (Quem precisar pode receber a permissão direto ou por outra role.)
 */
export class ReportsAdminOnly1762480010000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(
      `DELETE FROM role_permissions WHERE permission_key = 'reports.view' AND role_id = (SELECT id FROM roles WHERE key = 'analyst')`,
    );
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(
      `INSERT INTO role_permissions (role_id, permission_key) SELECT id, 'reports.view' FROM roles WHERE key = 'analyst' ON CONFLICT DO NOTHING`,
    );
  }
}
