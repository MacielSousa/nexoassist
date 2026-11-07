import type { MigrationInterface, QueryRunner } from "typeorm";
import { PERMISSIONS, SYSTEM_ROLES } from "@modules/accounts/dtos/permissions";

/**
 * Roles e permissões (RBAC).
 * - permissions: catálogo (espelho do código);
 * - roles + role_permissions: roles cadastráveis; as três de sistema vêm dos perfis antigos;
 * - user_permissions: permissões extras concedidas direto a um usuário;
 * - users.role (texto) vira users.role_id (FK), migrando cada usuário para a role equivalente.
 */
export class CreateRolesAndPermissions1762480008000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE permissions (
        key varchar PRIMARY KEY,
        "group" varchar NOT NULL,
        description varchar NOT NULL
      )
    `);
    await q.query(`
      CREATE TABLE roles (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        key varchar NOT NULL UNIQUE,
        name varchar NOT NULL UNIQUE,
        description varchar NOT NULL DEFAULT '',
        is_system boolean NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await q.query(`
      CREATE TABLE role_permissions (
        role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
        permission_key varchar NOT NULL REFERENCES permissions(key) ON DELETE CASCADE,
        PRIMARY KEY (role_id, permission_key)
      )
    `);
    await q.query(`
      CREATE TABLE user_permissions (
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        permission_key varchar NOT NULL REFERENCES permissions(key) ON DELETE CASCADE,
        granted_by_id uuid REFERENCES users(id),
        created_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (user_id, permission_key)
      )
    `);

    for (const p of PERMISSIONS) {
      await q.query(`INSERT INTO permissions (key, "group", description) VALUES ($1, $2, $3)`, [p.key, p.group, p.description]);
    }
    for (const r of SYSTEM_ROLES) {
      const [row] = (await q.query(`INSERT INTO roles (key, name, description, is_system) VALUES ($1, $2, $3, true) RETURNING id`, [r.key, r.name, r.description])) as { id: string }[];
      for (const p of r.permissions) await q.query(`INSERT INTO role_permissions (role_id, permission_key) VALUES ($1, $2)`, [row!.id, p]);
    }

    // Cada usuário vai para a role equivalente ao perfil antigo.
    await q.query(`ALTER TABLE users ADD COLUMN role_id uuid REFERENCES roles(id)`);
    await q.query(`UPDATE users u SET role_id = r.id FROM roles r WHERE r.key = u.role`);
    await q.query(`ALTER TABLE users ALTER COLUMN role_id SET NOT NULL`);
    await q.query(`ALTER TABLE users DROP COLUMN role`);
    await q.query(`CREATE INDEX users_role_idx ON users (role_id)`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE users ADD COLUMN role varchar`);
    await q.query(`UPDATE users u SET role = CASE r.key WHEN 'admin' THEN 'admin' WHEN 'analyst' THEN 'analyst' ELSE 'employee' END FROM roles r WHERE r.id = u.role_id`);
    await q.query(`ALTER TABLE users ALTER COLUMN role SET NOT NULL`);
    await q.query(`DROP INDEX users_role_idx`);
    await q.query(`ALTER TABLE users DROP COLUMN role_id`);
    await q.query(`DROP TABLE user_permissions`);
    await q.query(`DROP TABLE role_permissions`);
    await q.query(`DROP TABLE roles`);
    await q.query(`DROP TABLE permissions`);
  }
}
