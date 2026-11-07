import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Usuário com várias roles (macro) além das permissões diretas (micro).
 * users.role_id vira a tabela user_roles; cada usuário mantém a role que já tinha.
 */
export class CreateUserRoles1762480009000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE user_roles (
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
        granted_by_id uuid REFERENCES users(id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (user_id, role_id)
      )
    `);
    await q.query(`CREATE INDEX user_roles_role_idx ON user_roles (role_id)`);
    await q.query(`INSERT INTO user_roles (user_id, role_id) SELECT id, role_id FROM users`);
    await q.query(`ALTER TABLE users DROP COLUMN role_id`);
  }

  async down(q: QueryRunner): Promise<void> {
    // Volta a uma role por usuário: fica a de maior "peso" (admin > analyst > outras).
    await q.query(`ALTER TABLE users ADD COLUMN role_id uuid REFERENCES roles(id)`);
    await q.query(`
      UPDATE users u SET role_id = (
        SELECT ur.role_id FROM user_roles ur JOIN roles r ON r.id = ur.role_id
        WHERE ur.user_id = u.id
        ORDER BY CASE r.key WHEN 'admin' THEN 0 WHEN 'analyst' THEN 1 ELSE 2 END, ur.created_at
        LIMIT 1
      )
    `);
    await q.query(`UPDATE users SET role_id = (SELECT id FROM roles WHERE key = 'employee') WHERE role_id IS NULL`);
    await q.query(`ALTER TABLE users ALTER COLUMN role_id SET NOT NULL`);
    await q.query(`CREATE INDEX users_role_idx ON users (role_id)`);
    await q.query(`DROP TABLE user_roles`);
  }
}
