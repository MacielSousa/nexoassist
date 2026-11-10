# Nexo Assist

Agent de atendimento do service desk de TI da Nexo. O funcionário descreve o problema num chat. O agent:

- consulta os chamados dele;
- busca na central de ajuda;
- abre ou atualiza chamados (sempre com confirmação e sem duplicar);
- transfere para um analista quando precisa.

Os analistas atendem num console (trocando mensagens e anexos com o funcionário). O admin cadastra usuários, define o acesso de cada um (roles e permissões) e acompanha os relatórios.

**Sumário**

1. [Pré-requisitos (versões)](#1-pré-requisitos-versões)
2. [Rodar localmente, passo a passo](#2-rodar-localmente-passo-a-passo)
3. [Rodar tudo com Docker](#3-rodar-tudo-com-docker)
4. [Contas de teste](#4-contas-de-teste)
5. [Variáveis de ambiente](#5-variáveis-de-ambiente)
6. [Scripts](#6-scripts)
7. [Bibliotecas e para que servem](#7-bibliotecas-e-para-que-servem)
8. [Problemas comuns](#8-problemas-comuns)
9. [Funcionalidades](#9-funcionalidades)
10. [Arquitetura](#10-arquitetura)
11. [Como o agent decide](#11-como-o-agent-decide)
12. [Banco de dados](#12-banco-de-dados)
13. [Qualidade e segurança](#13-qualidade-e-segurança)
14. [Trade-offs e próximos passos](#14-trade-offs-e-próximos-passos)

---

## 1. Pré-requisitos (versões)

| Ferramenta | Versão | Observação |
|---|---|---|
| **Node.js** | **22 LTS** (mínimo 22.13; testado com 22.23.4) | o repositório tem `.nvmrc` com `22`. Versões mais novas (24, 25) também funcionam |
| **npm** | 10 ou mais novo | vem com o Node; o projeto usa *npm workspaces* |
| **Docker** + **Docker Compose v2** | Docker 24+ (testado com 29.3) | para o PostgreSQL 16 (e, se quiser, para subir tudo) |
| **Git** | qualquer recente | |
| Chave de um provedor de LLM | — | Anthropic, OpenAI ou Google (Gemini tem plano gratuito). Ver [Modelo](#modelo-llm) |

No Windows, rode o projeto **dentro do WSL 2** (Ubuntu), com o Docker Desktop integrado ao WSL.

Instalar o Node 22 com o [nvm](https://github.com/nvm-sh/nvm):

```bash
nvm install 22
```

```bash
nvm use        # dentro da pasta do projeto: lê o .nvmrc
```

## 2. Rodar localmente, passo a passo

Modo de desenvolvimento: banco no Docker, API e web rodando com *hot reload* na sua máquina.

**1. Clonar e instalar as dependências** (um `npm ci` na raiz instala a API e o web):

```bash
git clone <url-do-repositório> nexo-assist
cd nexo-assist
nvm use
npm ci
```

**2. Subir o banco** (PostgreSQL 16 em `localhost:5432`, usuário e senha `nexo`):

```bash
npm run db:up
```

Na primeira vez, o container também cria o banco `nexo_test` (usado em testes).

**3. Criar os arquivos de ambiente:**

```bash
cp apps/api/.env.example apps/api/.env
```

```bash
cp apps/web/.env.example apps/web/.env.local
```

Edite `apps/api/.env`:

- `JWT_SECRET`: obrigatório, no mínimo 32 caracteres. Gere um com `openssl rand -base64 48`;
- `NEXO_MODEL` e a chave do provedor escolhido (ver [Modelo](#modelo-llm)). Sem a chave, tudo funciona, menos as respostas do agent.

**4. Criar as tabelas e os dados de exemplo:**

```bash
npm run migration:run
```

```bash
npm run seed
```

O seed cria 10 usuários, chamados, artigos da central de ajuda e 60 dias de histórico para os relatórios. Se o banco já tiver dados, ele não faz nada.

**5. Rodar a API e o web juntos:**

```bash
npm run dev
```

| Endereço | O quê |
|---|---|
| http://localhost:3000 | aplicação (entre com uma das [contas de teste](#4-contas-de-teste)) |
| http://localhost:3333/api-docs | documentação da API (Swagger) |
| http://localhost:3333/health | saúde da API |

**6. Conferir que está tudo certo:**

```bash
npm test && npm run typecheck && npm run lint
```

## 3. Rodar tudo com Docker

Sobe Postgres, API e web já compilados (modo produção), sem instalar Node:

```bash
cp apps/api/.env.example apps/api/.env   # coloque a chave do modelo
docker compose up -d --build
```

- Na subida, a API aplica as migrations e roda o seed (só na primeira vez).
- Os anexos e fotos ficam no volume `uploads`; o banco, no volume `pgdata`.
- O compose define um `JWT_SECRET` de desenvolvimento e `DEMO_MODE=true` (mostra as contas de teste no login). Em produção real, troque os dois (ver [docs/SECURITY.md](docs/SECURITY.md)).

Parar e apagar tudo (inclusive os dados):

```bash
docker compose down -v
```

## 4. Contas de teste

Todas com a senha **`nexo1234`** (ou o valor de `SEED_PASSWORD`).

| E-mail | Role | Para testar |
|---|---|---|
| `admin@nexo.com.br` | Admin | usuários, roles e permissões, relatórios, console |
| `rafael.lima@nexo.com.br` | Analista (Suporte N2) | console: assumir, responder com anexo, devolver ao agent, encerrar |
| `julia.costa@nexo.com.br` | Analista (Suporte N1) | idem, fila N1 |
| `ana.souza@nexo.com.br` | Funcionário | abrir chamado de VPN; status do INC-20311 (vencido); pedir um analista |
| `carla.mendes@nexo.com.br` | Funcionário | reabrir chamado resolvido há 4 dias (SAP) |

Também há os funcionários Bruno, Diego, Elisa, Fábio e Gabriela, no formato `nome.sobrenome@nexo.com.br` (ex.: `bruno.tavares@nexo.com.br`).

Depois de 10 tentativas de senha erradas para o mesmo e-mail, o login fica bloqueado por 15 minutos.

## 5. Variáveis de ambiente

### API (`apps/api/.env`)

Validadas na inicialização (`src/config/env.ts`): se faltar algo obrigatório, a API não sobe e diz o quê.

| Variável | Padrão | Para quê |
|---|---|---|
| `PORT` | `3333` | porta da API |
| `CORS_ORIGIN` | `http://localhost:3000` | origens liberadas (separe por vírgula) |
| `DB_HOST` / `DB_PORT` | `localhost` / `5432` | Postgres |
| `DB_USER` / `DB_PASSWORD` / `DB_NAME` | `nexo` / `nexo` / `nexo` | credenciais do banco |
| `DB_LOGGING` | `false` | `true` mostra o SQL no terminal |
| **`JWT_SECRET`** | — (obrigatória) | assinatura dos tokens; mínimo 32 caracteres |
| `JWT_EXPIRES_IN` | `15m` | validade do token de acesso |
| `REFRESH_TOKEN_DAYS` | `30` | validade da sessão ("manter conectado") |
| `SEED_PASSWORD` | `nexo1234` | senha dos usuários criados pelo seed |
| `NEXO_MODEL` | `anthropic/claude-haiku-5-5` | modelo do agent, no formato `provedor/modelo` |
| `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `GOOGLE_GENERATIVE_AI_API_KEY` | — | preencha só a do provedor escolhido |
| `UPLOADS_DIR` | `apps/api/uploads` | onde ficam anexos e fotos de perfil (no Docker: volume `uploads`) |
| `SERVICE_DESK_FAILURE_RATE` | `0.05` | chance de falha aleatória do "sistema legado" de chamados |
| `SERVICE_DESK_OUTAGE` | `on` | liga as quedas periódicas simuladas do legado |
| `SERVICE_DESK_OUTAGE_PERIOD` / `_SECONDS` | `240` / `5` | a cada 240 s, fica 5 s fora do ar |

### Web (`apps/web/.env.local`)

| Variável | Padrão | Para quê |
|---|---|---|
| `API_URL` | `http://localhost:3333` | endereço da API (no compose: `http://api:3333`) |
| `DEMO_MODE` | — | `true` mostra as contas de teste no login em produção (em desenvolvimento aparecem sempre) |
| `INSECURE_COOKIES` | — | `true` tira a flag `Secure` dos cookies em produção sem HTTPS (só para `localhost`) |

### Modelo (LLM)

| Provedor | `NEXO_MODEL` | Chave |
|---|---|---|
| Anthropic (padrão) | `anthropic/claude-haiku-5-5` | `ANTHROPIC_API_KEY` |
| OpenAI | `openai/gpt-5.4-mini` | `OPENAI_API_KEY` |
| Google (tem plano gratuito) | `google/gemini-2.5-flash` | `GOOGLE_GENERATIVE_AI_API_KEY` |

Depois de trocar o modelo ou a chave, reinicie a API.

O padrão é um modelo pequeno: o trabalho do agent é rotear, chamar tools e responder curto, com baixa latência e baixo custo. Para economizar, o histórico é limitado às 20 últimas mensagens, a prioridade e o prazo são calculados em código, e a confirmação de chamado não chama o modelo.

## 6. Scripts

Na raiz (valem para os dois apps):

| Comando | O que faz |
|---|---|
| `npm run dev` | API (`:3333`) e web (`:3000`) juntos, com hot reload |
| `npm run db:up` | sobe só o Postgres no Docker |
| `npm run migration:run` | aplica as migrations pendentes |
| `npm run seed` | popula o banco (só se estiver vazio) |
| `npm test` | testes da API (Vitest) |
| `npm run typecheck` | TypeScript nos dois apps |
| `npm run lint` | ESLint no web |

Só na API (`-w apps/api`):

| Comando | O que faz |
|---|---|
| `npm run migration:create -w apps/api -- src/shared/infra/typeorm/migrations/NomeDaMudanca` | cria uma migration vazia |
| `npm run migration:revert -w apps/api` | desfaz a última migration |
| `npm run seed:history -w apps/api` | gera de novo os 60 dias de histórico dos relatórios |
| `npm run test:watch -w apps/api` | testes em modo watch |
| `npm run build -w apps/api` / `npm start -w apps/api` | compila para `dist/` e roda a versão compilada |

## 7. Bibliotecas e para que servem

### API (`apps/api`)

| Biblioteca | Versão | Uso |
|---|---|---|
| `express` | 5.3 | servidor HTTP e rotas |
| `typeorm` + `pg` | 0.3.31 + 8.23 | ORM, migrations e driver do PostgreSQL |
| `reflect-metadata` | 0.2 | metadados dos decorators (TypeORM e tsyringe) |
| `tsyringe` | 4.10 | injeção de dependência (repositórios e providers) |
| `zod` | 4.6 | validação de entrada e das variáveis de ambiente |
| `@asteasolutions/zod-to-openapi` + `swagger-ui-express` | 9.1 + 5.0 | gera o Swagger a partir dos mesmos schemas zod |
| `@mastra/core` | 1.82 | o agent: tools, roteador de modelos (Anthropic/OpenAI/Google) e streaming |
| `jsonwebtoken` | 9.0 | token de acesso (JWT) |
| `bcryptjs` | 3.0 | hash das senhas |
| `multer` | 2.5 | upload de anexos e fotos (em memória, depois validado e salvo) |
| `cors` | 2.8 | CORS |
| `typescript` | 6.0 | linguagem (modo `strict` + `noUncheckedIndexedAccess`) |
| `tsx` | 4.23 | roda TypeScript direto em desenvolvimento (`tsx watch`) |
| `tsc-alias` | 1.9 | resolve os aliases (`@modules`, `@shared`, `@config`) no build |
| `vitest` | 4.1 | testes |

### Web (`apps/web`)

| Biblioteca | Versão | Uso |
|---|---|---|
| `next` | 16.4 | framework (App Router, server components, server actions) |
| `react` / `react-dom` | 19.3 | interface |
| `tailwindcss` + `@tailwindcss/postcss` | 4.3 | estilos |
| `lucide-react` | 1.70 | ícones |
| `eslint` + `eslint-config-next` | 9.39 + 16.4 | lint |
| `typescript` | 6.0 | linguagem |

### Raiz e infra

| Item | Uso |
|---|---|
| `concurrently` 9.2 | roda API e web no mesmo terminal (`npm run dev`) |
| `postgres:16-alpine` | banco (docker-compose) |
| `node:22-alpine` | base das imagens Docker da API e do web |

## 8. Problemas comuns

| Sintoma | Causa e solução |
|---|---|
| A API não sobe: "Variáveis de ambiente inválidas… JWT_SECRET" | falta `JWT_SECRET` (mínimo 32 caracteres) em `apps/api/.env` |
| `ECONNREFUSED 127.0.0.1:5432` | o banco não está rodando: `npm run db:up` (e espere ficar *healthy* em `docker ps`) |
| `relation "users" does not exist` | faltou `npm run migration:run` |
| Login: "E-mail ou senha incorretos" com a conta do seed | o banco foi populado com outro `SEED_PASSWORD`, ou a senha foi trocada no perfil |
| Login: "Usuário desativado. Procure a TI." | o admin desativou a conta: reative em **Usuários** (ícone verde) |
| Login: "Muitas tentativas…" (429) | 10 senhas erradas para o mesmo e-mail: espere 15 minutos (ou reinicie a API em desenvolvimento) |
| O agent responde "Tive um problema para responder agora" | o provedor do LLM recusou. O motivo aparece em **Como decidi** (ou em `messages.trace`). O mais comum é a **conta sem créditos** ("You have no credits remaining"): adicione créditos no provedor ou troque para outro (ex.: Gemini, que tem plano gratuito) |
| O chat diz que falta configurar o modelo | `NEXO_MODEL` aponta para um provedor sem chave no `.env` |
| Porta 3000, 3333 ou 5432 em uso | pare o outro processo, ou o `docker compose` (se ele estiver rodando a versão em Docker ao mesmo tempo) |
| Tela antiga depois de atualizar o código | recarregue com Ctrl+Shift+R |

## 9. Funcionalidades

| Para quem | O quê |
|---|---|
| Funcionário | chat com o agent (passos e decisões visíveis); chamados abertos/atualizados só com confirmação; anexos (imagens, vídeos, documentos) |
| Analista | console com fila (N1/N2): assumir conversa, responder com anexos, devolver ao agent, encerrar; vê o resumo da transferência e o raciocínio do agent |
| Admin | usuários (cadastro, edição, foto, ativação, redefinição de senha); **acesso** de cada pessoa (roles + permissões diretas); cadastro de roles; relatórios com filtros e exportação CSV |
| Todos | perfil próprio (clicando na própria foto em qualquer tela): nome, área, foto, e-mail (com a senha atual) e senha |

### Acesso: roles (macro) e permissões diretas (micro)

- Uma **role** é um pacote de permissões. Um usuário pode ter **várias**.
- Uma **permissão direta** é concedida a uma pessoa específica, para o que nenhuma role cobre.
- O acesso efetivo é a soma das duas. Na tela **Usuários → Acesso**, as permissões que vêm de uma role aparecem com a origem.

| Role de sistema | Permissões |
|---|---|
| Admin | todas |
| Analista | ver e tratar todos os chamados; ver e atender conversas no console |
| Funcionário | usar o chat; ver e abrir os próprios chamados |

Relatórios (`reports.view`) são só do Admin, mas podem ser concedidos a outra pessoa como permissão direta.

Regras (garantidas pela API):

- ninguém concede o que não tem (salvo quem gerencia roles);
- ninguém altera o próprio acesso;
- o sistema nunca fica sem alguém que gerencie usuários e roles.

## 10. Arquitetura

| Parte | Tecnologia |
|---|---|
| API (`apps/api`) | Node.js + TypeScript estrito, Express 5, TypeORM + PostgreSQL 16, tsyringe, zod, **Mastra** (agent), Swagger |
| Web (`apps/web`) | Next.js 16 (App Router) + Tailwind 4, só interface |
| Infra | Docker, docker-compose, migrations do TypeORM, seed |

```
nexo-assist/
├─ apps/
│  ├─ api/                       API REST (Express + TypeORM + Mastra)
│  │  └─ src/
│  │     ├─ config/              env validado (zod) e config de auth
│  │     ├─ modules/
│  │     │  ├─ accounts/         usuários, roles, permissões, login (JWT + refresh token), perfil
│  │     │  ├─ tickets/          chamados, central de ajuda, regras do service desk
│  │     │  ├─ support/          conversas, agent, rascunhos, console do analista
│  │     │  ├─ files/            anexos e fotos (validação pelo conteúdo, download protegido)
│  │     │  └─ reports/          relatórios e CSV
│  │     └─ shared/
│  │        ├─ container/        injeção de dependência (tsyringe) e providers
│  │        ├─ errors/AppError   erro de negócio com status HTTP
│  │        └─ infra/
│  │           ├─ http/          app Express, rotas, middlewares, Swagger, SSE
│  │           └─ typeorm/       data-source, migrations, seed
│  └─ web/                       Next.js: telas + proxy para a API
├─ docker/postgres/init/         cria o banco de testes
├─ docs/SECURITY.md              proteções e pontos de atenção
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

Fluxo de uma requisição: rota (`defineRoute`) → autenticação e permissões → controller (valida com zod) → use case (regra de negócio) → repositório (interface injetada pelo tsyringe).

### Como adicionar uma funcionalidade

1. Se mudar o banco, crie a migration (`npm run migration:create -w apps/api -- src/shared/infra/typeorm/migrations/AddX`), escreva o SQL em `up`/`down` e ajuste a entity.
2. Crie `useCases/<nomeDoCaso>/` com o `UseCase` (recebe interfaces pelo construtor) e o `Controller` (schemas zod estáticos + `handle`).
3. Registre a rota com `defineRoute(...)` em `shared/infra/http/routes/*.routes.ts`, com as permissões exigidas em `auth`. Ela cria a rota no Express **e** a documentação no Swagger.
4. Se for uma permissão nova, acrescente em `modules/accounts/dtos/permissions.ts` e numa migration.
5. Escreva o teste `*.spec.ts` ao lado do use case, usando os repositórios `in-memory`.

### Separação entre backend e frontend

- **A API** é a única que acessa o banco, o modelo de IA e as regras.
- **O web** só renderiza. As páginas buscam dados pelo servidor do Next (`lib/api.ts`). Os componentes do navegador chamam `/api/*`, um proxy (`app/api/[...path]/route.ts`) que repassa à API.
- **Sessão:** o login devolve um JWT curto (15 min) e um refresh token (30 dias; o banco guarda só o hash). O web guarda os dois em **cookies httpOnly**, então o JavaScript do navegador nunca vê o token. `src/proxy.ts` renova o token antes de vencer.

## 11. Como o agent decide

O agent (`modules/support/agent`) tem instruções curtas (`instructions.ts`) e 9 tools (`tools.ts`):

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

- **Identidade:** quem age vem do token e entra nas tools pelo `RequestContext` do Mastra; nenhuma tool aceita "de quem" como parâmetro. Os use cases também conferem o dono (chamado alheio responde 404).
- **O agent não acessa o banco.** Ele usa só o `IServiceDeskProvider`, que simula as quedas do sistema legado e tenta de novo com backoff (0,4, 0,8 e 1,6 s). Se ainda falhar, a tool devolve o erro como dado e o agent avisa em vez de inventar.
- **Prioridade e prazo vêm de código** (`tickets/domain/ticketRules.ts`). O LLM só extrai os fatos.
- **Confirmação antes de agir:** o chamado só é criado quando o funcionário clica em Confirmar, numa rota sem LLM; o id do rascunho é a chave de idempotência.
- **Baixa confiança:** com confiança < 0,5 e sem transferência, o servidor transfere.
- **Pausa:** com a conversa aguardando ou com um analista, o agent não roda.
- **Limites:** 30 mensagens por conversa, uma resposta por vez, no máximo 8 passos de tool por resposta.

Transparência: acima de cada resposta aparecem os passos do agent, e **Como decidi** mostra intenção, confiança, justificativa, cada tool (entrada, resultado, tempo), modelo, tokens e latência. Tudo fica em `messages.trace` (jsonb), visível também no console do analista.

## 12. Banco de dados

Criado pelas migrations em `apps/api/src/shared/infra/typeorm/migrations`:

| Tabela | Conteúdo |
|---|---|
| `users` | pessoas (nome, e-mail, senha com bcrypt, área, fila N1/N2, foto, ativo) |
| `roles` / `permissions` / `role_permissions` | roles cadastráveis e o catálogo de permissões |
| `user_roles` / `user_permissions` | roles de cada usuário (macro) e permissões diretas (micro) |
| `users_tokens` | hash dos refresh tokens |
| `tickets` + `ticket_comments` | chamados e histórico; numeração por sequência |
| `articles` | central de ajuda |
| `conversations` | estado `agent → waiting_human → human → closed`; no máximo uma ativa por funcionário |
| `messages` | mensagens com passos, cards, anexos e trace (jsonb) |
| `drafts` | rascunhos aguardando confirmação |
| `files` | anexos e fotos de perfil (metadados; o arquivo fica em `UPLOADS_DIR`) |

## 13. Qualidade e segurança

- **51 testes** na API (`npm test`), com repositórios em memória: regras de domínio (SLA, prioridade, duplicidade), autenticação, roles e permissões (soma de roles, sem escalada, sem lockout), chamados (privacidade, idempotência, reabertura), anexos e atendimento (rascunho, transferência, pausa, falha do modelo). O LLM é substituído por um runner falso; as tools rodam de verdade.
- TypeScript `strict` com `noUncheckedIndexedAccess` nos dois apps; ESLint no web.
- Segurança (detalhes em [docs/SECURITY.md](docs/SECURITY.md)): limite de tentativas de login, cookies httpOnly, refresh token só em hash, RBAC em todas as rotas, 404 para recursos alheios, uploads validados pelo conteúdo, cabeçalhos de segurança, proteção contra CSRF no proxy.

## 14. Trade-offs e próximos passos

- **Tempo real com pub/sub em memória:** funciona com uma instância. Para escalar, trocaria por Redis ou LISTEN/NOTIFY do Postgres (mesma interface); o mesmo vale para os limites de tentativas.
- **Duplicidade por similaridade léxica:** explicável, e o agent confirma com o funcionário. Embeddings (pgvector) pegariam paráfrases.
- **Login próprio:** em produção seria SSO corporativo, com recuperação de senha por e-mail.
- **Próximos passos:** testes de integração HTTP (Supertest contra `nexo_test`), avaliações automáticas do agent, feriados no SLA, CI com build das imagens, atualizar o TypeORM para 1.x (resolve os alertas moderados do `npm audit`).
