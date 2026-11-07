import { container } from "tsyringe";

import { env } from "@config/env";
import { UsersRepository } from "@modules/accounts/infra/typeorm/repositories/UsersRepository";
import { UsersTokensRepository } from "@modules/accounts/infra/typeorm/repositories/UsersTokensRepository";
import type { IUsersRepository } from "@modules/accounts/repositories/IUsersRepository";
import type { IUsersTokensRepository } from "@modules/accounts/repositories/IUsersTokensRepository";
import { ArticlesRepository } from "@modules/tickets/infra/typeorm/repositories/ArticlesRepository";
import { TicketsRepository } from "@modules/tickets/infra/typeorm/repositories/TicketsRepository";
import type { IServiceDeskProvider } from "@modules/tickets/providers/ServiceDeskProvider/IServiceDeskProvider";
import { LegacyServiceDeskProvider } from "@modules/tickets/providers/ServiceDeskProvider/implementations/LegacyServiceDeskProvider";
import type { IArticlesRepository } from "@modules/tickets/repositories/IArticlesRepository";
import type { ITicketsRepository } from "@modules/tickets/repositories/ITicketsRepository";

import { MastraAgentRunner, type IAgentRunner } from "@modules/support/agent/AgentRunner";
import { ConversationsRepository } from "@modules/support/infra/typeorm/repositories/ConversationsRepository";
import { DraftsRepository } from "@modules/support/infra/typeorm/repositories/DraftsRepository";
import { MessagesRepository } from "@modules/support/infra/typeorm/repositories/MessagesRepository";
import type { IConversationEventsProvider } from "@modules/support/providers/ConversationEventsProvider/IConversationEventsProvider";
import { InMemoryConversationEvents } from "@modules/support/providers/ConversationEventsProvider/implementations/InMemoryConversationEvents";
import type { IConversationsRepository } from "@modules/support/repositories/IConversationsRepository";
import type { IDraftsRepository } from "@modules/support/repositories/IDraftsRepository";
import type { IMessagesRepository } from "@modules/support/repositories/IMessagesRepository";

import { ReportsRepository } from "@modules/reports/infra/typeorm/repositories/ReportsRepository";
import type { IReportsRepository } from "@modules/reports/repositories/IReportsRepository";

import "./providers";

// Injeção de dependências: cada interface aponta para a implementação usada em produção.
// Nos testes, os use cases recebem as versões em memória direto no construtor.

// accounts
container.registerSingleton<IUsersRepository>("UsersRepository", UsersRepository);
container.registerSingleton<IUsersTokensRepository>("UsersTokensRepository", UsersTokensRepository);

// tickets
container.registerSingleton<ITicketsRepository>("TicketsRepository", TicketsRepository);
container.registerSingleton<IArticlesRepository>("ArticlesRepository", ArticlesRepository);
container.register<IServiceDeskProvider>("ServiceDeskProvider", {
  useFactory: (c) =>
    new LegacyServiceDeskProvider(
      c.resolve<ITicketsRepository>("TicketsRepository"),
      c.resolve<IArticlesRepository>("ArticlesRepository"),
      c.resolve<IUsersRepository>("UsersRepository"),
      {
        failureRate: env.SERVICE_DESK_FAILURE_RATE,
        outage: env.SERVICE_DESK_OUTAGE === "on" ? { periodSec: env.SERVICE_DESK_OUTAGE_PERIOD, downSec: env.SERVICE_DESK_OUTAGE_SECONDS } : null,
        latencyMs: [80, 350],
      },
    ),
});

// support (atendimento)
container.registerSingleton<IConversationsRepository>("ConversationsRepository", ConversationsRepository);
container.registerSingleton<IMessagesRepository>("MessagesRepository", MessagesRepository);
container.registerSingleton<IDraftsRepository>("DraftsRepository", DraftsRepository);
container.registerSingleton<IConversationEventsProvider>("ConversationEventsProvider", InMemoryConversationEvents);
container.registerSingleton<IAgentRunner>("AgentRunner", MastraAgentRunner);

// reports
container.registerSingleton<IReportsRepository>("ReportsRepository", ReportsRepository);
