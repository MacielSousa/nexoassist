import { homedir } from "node:os";
import { join } from "node:path";

/**
 * Pasta dos bancos SQLite. Fica fora do projeto de propósito: o watcher do Next em dev
 * trata escritas do SQLite (WAL) dentro do projeto como mudança de código e recarrega a página.
 */
export function dataDir(): string {
  return process.env.NEXO_DATA_DIR ?? join(homedir(), ".nexo-assist");
}
