import { env } from "@config/env";
import { AppDataSource } from "@shared/infra/typeorm/data-source";
import { app } from "./app";

async function bootstrap() {
  await AppDataSource.initialize();
  app.listen(env.PORT, () => {
    console.log(`API do Nexo Assist em http://localhost:${env.PORT} (docs em /api-docs)`);
  });
}

bootstrap().catch((err) => {
  console.error("Falha ao iniciar a API:", err);
  process.exit(1);
});
