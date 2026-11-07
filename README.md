# Nexo Assist

Agent de atendimento do service desk de TI da Nexo. O funcionário descreve o problema num chat. O agent:

- consulta os chamados dele;
- busca na central de ajuda;
- abre ou atualiza chamados (sempre com confirmação e sem duplicar);
- transfere para um analista quando precisa.

Os analistas atendem num console, e o admin cadastra funcionários e analistas.

| Parte | Tecnologia |
|---|---|
| API (`apps/api`) | Node.js + TypeScript estrito, Express 5, TypeORM 0.3 + PostgreSQL 16, tsyringe (injeção de dependência), zod, **Mastra** (agent), Swagger/OpenAPI |
| Web (`apps/web`) | Next.js 16 (App Router) + Tailwind 4, só interface |
| Infra | Docker, docker-compose, migrations do TypeORM, seed |

## Como rodar

### Com Docker (um comando)

```bash
cp apps/api/.env.example apps/api/.env   # coloque a chave do modelo (veja "Modelo")
docker compose up -d --build
```

| Endereço | Para quê |
|---|---|
| http://localhost:3000 | Aplicação |
| http://localhost:3333/api-docs | Documentação da API (Swagger) |
| localhost:5432 | Postgres (`nexo` / `nexo`) |

Na subida, a API aplica as migrations e roda o seed (só na primeira vez).

### Em desenvolvimento (hot reload)

```bash
npm install
docker compose up -d postgres            # só o banco
cp apps/api/.env.example apps/api/.env   # gere um JWT_SECRET: openssl rand -base64 48
cp apps/web/.env.example apps/web/.env.local
npm run migration:run
npm run seed
npm run dev                              # API em :3333 e web em :3000
```

### Contas do seed (senha `nexo1234`)

| E-mail | Perfil | Para testar |
|---|---|---|
| `ana.souza@nexo.com.br` | funcionária | abrir chamado de VPN; status do INC-20311 (vencido); transferência |
| `carla.mendes@nexo.com.br` | funcionária | reabrir chamado resolvido há 4 dias (SAP) |
| `rafael.lima@nexo.com.br` | analista N2 | console: assumir, responder, devolver, encerrar |
| `admin@nexo.com.br` | admin | cadastrar e editar usuários; também acessa o console |

### Comandos úteis

```bash
npm test                                    # testes da API (Vitest)
npm run typecheck                           # API e web
npm run migration:create -w apps/api -- src/shared/infra/typeorm/migrations/NomeDaMudanca
npm run migration:revert -w apps/api
docker compose down -v                      # derruba tudo e apaga o banco
```

## Arquitetura

```
nexo-assist/
├─ apps/
│  ├─ api/                       API REST (Express + TypeORM + Mastra)
│  │  └─ src/
│  │     ├─ config/              env validado (zod) e config de auth
│  │     ├─ modules/
│  │     │  ├─ accounts/         usuários, perfis, login (JWT + refresh token)
│  │     │  ├─ tickets/          chamados, central de ajuda, regras do service desk
│  │     │  └─ support/          conversas, agent, rascunhos, console do analista
│  │     └─ shared/
│  │        ├─ container/        injeção de dependência (tsyringe) e providers
│  │        ├─ errors/AppError   erro de negócio com status HTTP
│  │        └─ infra/
│  │           ├─ http/          app Express, rotas, middlewares, Swagger, SSE
│  │           └─ typeorm/       data-source, migrations, seed
│  └─ web/                       Next.js: telas + proxy para a API
├─ docker/postgres/init/         cria o banco de testes
└─ docker-compose.yml            postgres + api + web
```

### Dentro de um módulo (padrão do rentx)

```
modules/tickets/
├─ domain/              regras puras: prioridade, prazos (SLA), duplicidade — sem banco, fáceis de testar
├─ dtos/                formatos de entrada entre camadas
├─ infra/typeorm/
│  ├─ entities/         mapeamento das tabelas (TypeORM)
│  └─ repositories/     implementação dos repositórios com TypeORM
├─ repositories/
│  ├─ ITicketsRepository.ts   interface (o que o use case precisa)
│  └─ in-memory/              implementação em memória, para testes
├─ mapper/              entidade → resposta da API (com schema zod, que vira Swagger)
├─ providers/           integrações (aqui: o "sistema legado" de chamados)
└─ useCases/
   └─ createTicket/
      ├─ CreateTicketUseCase.ts      regra de negócio (não conhece HTTP)
      └─ CreateTicketController.ts   HTTP: valida a entrada (zod) e chama o use case
```

O fluxo de uma requisição:

1. Rota (`shared/infra/http/routes`)
2. Middlewares de autenticação e de perfil
3. Controller, que valida a entrada com zod
4. Use case, que aplica a regra de negócio
5. Repositório, que é uma interface injetada pelo tsyringe

### Como adicionar uma funcionalidade

1. Se mudar o banco, crie a migration: `npm run migration:create -w apps/api -- src/shared/infra/typeorm/migrations/AddX`. Escreva o SQL em `up`/`down` e ajuste a entity.
2. Crie a pasta `useCases/<nomeDoCaso>/` com o `UseCase` (recebe interfaces pelo construtor) e o `Controller` (schemas zod estáticos + `handle`).
3. Registre a rota com `defineRoute(...)` em `shared/infra/http/routes/*.routes.ts`. Ela cria a rota no Express **e** a documentação no Swagger, com os mesmos schemas.
4. Escreva o teste `*.spec.ts` ao lado do use case, usando os repositórios `in-memory`.
5. Se criou uma interface nova, registre a implementação em `shared/container/index.ts`.

## Separação entre backend e frontend

- **A API** é a única que acessa o banco, o modelo de IA e as regras.
- **O web** só renderiza:
  - as páginas buscam dados na API pelo servidor do Next (`lib/api.ts`);
  - os componentes do navegador chamam `/api/*`, um proxy (`app/api/[...path]/route.ts`) que repassa à API.
- **Sessão:**
  - o login devolve um JWT curto (15 min) e um refresh token (30 dias, salvo no banco);
  - o web guarda os dois em **cookies httpOnly**, então o JavaScript do navegador nunca vê o token;
  - `src/proxy.ts` renova o token de acesso antes de vencer;
  - sair, trocar a senha ou ser desativado invalida os refresh tokens.

## Como o agent decide (`modules/support/agent`)

O agent tem instruções curtas (`instructions.ts`) e 9 tools (`tools.ts`):

| Tool | Para quê |
|---|---|
| `buscar_central_ajuda` | resolver sem fila, respeitando as condições do artigo |
| `listar_meus_chamados` / `consultar_chamado` | status, prazo e vencimento (calculados, não inventados) |
| `mostrar_seletor_chamados` / `oferecer_opcoes` | perguntas fechadas viram cliques |
| `preparar_rascunho_chamado` | verifica duplicidade, classifica prioridade, calcula SLA e mostra o card; **não cria** |
| `preparar_atualizacao_chamado` | complementar ou reabrir (só se resolvido há até 7 dias) |
| `transferir_para_analista` | pedido do funcionário, caso crítico, prazo vencido ou falta de segurança; inclui um resumo para o analista |
| `registrar_decisao` | intenção, confiança (0–1) e justificativa, uma vez por resposta |

Garantias que **não dependem do modelo obedecer**:

- **Identidade e privacidade:**
  - quem age vem do token e entra nas tools pelo `RequestContext` do Mastra; nenhuma tool aceita "de quem" como parâmetro;
  - os use cases de chamados também conferem o dono: para um funcionário, um chamado alheio responde 404.
- **O agent não acessa o banco.** Ele usa só o `IServiceDeskProvider`, como usaria o sistema legado real. Esse provider simula as quedas do legado (janelas de 5 s, falhas aleatórias, latência) e tenta de novo com backoff (0,4, 0,8 e 1,6 s). Se ainda assim falhar, a tool devolve o erro como dado, e o agent avisa em vez de inventar.
- **Prioridade e prazo vêm de código** (`tickets/domain/ticketRules.ts`, regras do Anexo A). O LLM só extrai os fatos: quem é afetado, se impede de trabalhar, se há compromisso hoje.
- **Confirmação antes de agir:** o chamado só é criado ou atualizado quando o funcionário clica em Confirmar. Isso acontece numa rota determinística, sem LLM, e o id do rascunho é a chave de idempotência.
- **Baixa confiança:** se o agent registra confiança < 0,5 e não transfere, o servidor transfere.
- **Pausa:** com a conversa aguardando ou com um analista, o agent não roda.
- **Limites:** 30 mensagens por conversa, uma resposta por vez e no máximo 8 passos de tool por resposta.

### Transparência

- Acima de cada resposta aparecem os passos do agent.
- **Como decidi** mostra:
  - a intenção, a confiança e a justificativa;
  - cada tool com entrada, resultado e tempo;
  - o modelo, os tokens e a latência.
- Tudo fica salvo em `messages.trace` (jsonb). O console do analista mostra o mesmo, além do resumo da transferência.

## Modelo

O modelo é configurável em `apps/api/.env` (`NEXO_MODEL`, no formato do roteador de modelos do Mastra), junto com a chave do provedor:

| Provedor | `NEXO_MODEL` | Chave |
|---|---|---|
| Anthropic (padrão) | `anthropic/claude-haiku-5-5` | `ANTHROPIC_API_KEY` |
| OpenAI | `openai/gpt-5.4-mini` | `OPENAI_API_KEY` |
| Google (tem plano gratuito) | `google/gemini-2.5-flash` | `GOOGLE_GENERATIVE_AI_API_KEY` |

O padrão é um modelo pequeno porque o trabalho do agent é rotear, chamar tools e responder curto. Ele tem baixa latência e baixo custo por conversa.

Para economizar:

- histórico limitado às 20 últimas mensagens;
- prioridade e prazo calculados em código;
- confirmação sem chamada ao modelo.

Sem a chave, o chat avisa que falta configurar. Se o provedor recusar (ex.: sem créditos), o funcionário vê uma mensagem amigável e o motivo fica em "Como decidi".

## Banco de dados

As tabelas são criadas pelas migrations em `apps/api/src/shared/infra/typeorm/migrations`:

| Tabela | Conteúdo |
|---|---|
| `users` | admins, analistas (com fila N1/N2) e funcionários; senha com bcrypt |
| `users_tokens` | refresh tokens |
| `tickets` + `ticket_comments` | chamados e histórico; numeração por sequência (`ticket_inc_seq`, `ticket_req_seq`) |
| `articles` | central de ajuda |
| `conversations` | estado `agent → waiting_human → human → closed`; no máximo uma ativa por funcionário (índice único parcial) |
| `messages` | mensagens com passos, cards e trace (jsonb) |
| `drafts` | rascunhos aguardando confirmação (`D-381`...) |

## Qualidade

- **40 testes de unidade** na API (`npm test`), com repositórios em memória (padrão do rentx), cobrindo:
  - regras de domínio: horário útil, SLA, prioridade, duplicidade;
  - autenticação e cadastro;
  - chamados: privacidade, idempotência, reabertura, retry do legado;
  - atendimento: rascunho só vira chamado na confirmação, transferência por baixa confiança, pausa e retomada do agent, limite de mensagens, falha do modelo.
- O LLM é substituído por um `IAgentRunner` falso nos testes. As tools rodam de verdade contra o legado em memória.
- TypeScript `strict` com `noUncheckedIndexedAccess` nos dois apps; ESLint no web.

## Trade-offs e o que eu faria com mais tempo

- **Tempo real com pub/sub em memória.** Funciona com uma instância da API. Para escalar, trocaria `InMemoryConversationEvents` por Redis ou LISTEN/NOTIFY do Postgres, que implementam a mesma interface. O lock de "uma resposta por vez" também iria para o Redis.
- **Duplicidade por similaridade léxica.** É explicável e o agent confirma com o funcionário. Embeddings (pgvector) pegariam paráfrases.
- **Central de ajuda pontuada em memória.** É suficiente para dezenas de artigos; com milhares, usaria full-text search do Postgres.
- **Login próprio com e-mail e senha.** Em produção seria SSO corporativo, e a recuperação de senha seria por e-mail.
- **Próximos passos:**
  - testes de integração HTTP com Supertest contra o banco `nexo_test` (já criado pelo compose);
  - avaliações automáticas do agent com cenários reais;
  - feriados no SLA;
  - métricas no console;
  - CI com build das imagens.
