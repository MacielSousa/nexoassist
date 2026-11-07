import type { MigrationInterface, QueryRunner } from "typeorm";

export class CreateUsers1762480000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE users (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name varchar NOT NULL,
        email varchar NOT NULL UNIQUE,
        password varchar NOT NULL,
        role varchar NOT NULL CHECK (role IN ('admin', 'analyst', 'employee')),
        department varchar NOT NULL,
        team varchar CHECK (team IN ('Suporte N1', 'Suporte N2')),
        active boolean NOT NULL DEFAULT true,
        password_changed_at timestamptz NOT NULL DEFAULT now(),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE users`);
  }
}
