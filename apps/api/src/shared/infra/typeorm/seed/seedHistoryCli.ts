import "reflect-metadata";
import { AppDataSource } from "../data-source";
import { seedHistory } from "./history";

/** Uso: npm run seed:history — adiciona 60 dias de histórico de exemplo (só se ainda não houver). */
async function run() {
  await AppDataSource.initialize();
  const [row] = (await AppDataSource.query(`SELECT COUNT(*)::int AS count FROM tickets`)) as { count: number }[];
  if (row!.count > 30) {
    console.log("O banco já tem histórico; nada a fazer.");
    return;
  }
  await AppDataSource.transaction((tx) => seedHistory(tx));
}

run()
  .catch((err) => {
    console.error("Falha ao gerar histórico:", err);
    process.exitCode = 1;
  })
  .finally(() => AppDataSource.destroy());
