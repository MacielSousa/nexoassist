// Ponto de entrada da CLI do TypeORM (migration:run, migration:create...).
// Fica dentro de src para ser compilado junto e funcionar igual em dev (tsx) e no Docker (node dist).
import "typeorm/cli";
