import "reflect-metadata";
import { join } from "node:path";
import { DataSource } from "typeorm";
import { env } from "@config/env";

/**
 * Conexão com o Postgres. Entities e migrations são carregadas por glob para que
 * criar um módulo novo não exija editar este arquivo. synchronize fica desligado:
 * o schema só muda por migration.
 */
export const AppDataSource = new DataSource({
  type: "postgres",
  host: env.DB_HOST,
  port: env.DB_PORT,
  username: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  synchronize: false,
  logging: env.DB_LOGGING,
  entities: [join(__dirname, "../../../modules/**/infra/typeorm/entities/*.{ts,js}")],
  migrations: [join(__dirname, "migrations/*.{ts,js}")],
});
