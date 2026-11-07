import { container } from "tsyringe";

import { UsersRepository } from "@modules/accounts/infra/typeorm/repositories/UsersRepository";
import { UsersTokensRepository } from "@modules/accounts/infra/typeorm/repositories/UsersTokensRepository";
import type { IUsersRepository } from "@modules/accounts/repositories/IUsersRepository";
import type { IUsersTokensRepository } from "@modules/accounts/repositories/IUsersTokensRepository";

import "./providers";

// Injeção de dependências: cada interface aponta para a implementação usada em produção.
// Nos testes, os use cases recebem as versões em memória direto no construtor.

container.registerSingleton<IUsersRepository>("UsersRepository", UsersRepository);
container.registerSingleton<IUsersTokensRepository>("UsersTokensRepository", UsersTokensRepository);
