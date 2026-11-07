import type { MigrationInterface, QueryRunner } from "typeorm";

/** Arquivos enviados (fotos de perfil e anexos do chat) e as referências a eles. */
export class CreateFiles1762480007000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE files (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        owner_id uuid NOT NULL REFERENCES users(id),
        purpose varchar NOT NULL CHECK (purpose IN ('avatar', 'attachment')),
        conversation_id uuid REFERENCES conversations(id) ON DELETE CASCADE,
        original_name varchar NOT NULL,
        mime varchar NOT NULL,
        size integer NOT NULL,
        storage_key varchar NOT NULL UNIQUE,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE INDEX files_conversation_idx ON files (conversation_id)`);
    await queryRunner.query(`ALTER TABLE users ADD COLUMN avatar_file_id uuid REFERENCES files(id) ON DELETE SET NULL`);
    await queryRunner.query(`ALTER TABLE messages ADD COLUMN attachments jsonb NOT NULL DEFAULT '[]'`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE messages DROP COLUMN attachments`);
    await queryRunner.query(`ALTER TABLE users DROP COLUMN avatar_file_id`);
    await queryRunner.query(`DROP TABLE files`);
  }
}
