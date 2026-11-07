# Nexo Assist

Agent de atendimento do service desk de TI da Nexo. O funcionário descreve o problema num chat. O agent:

- consulta os chamados dele;
- busca na central de ajuda;
- abre ou atualiza chamados (sempre com confirmação, sem duplicar);
- transfere para um analista quando precisa.

O analista acompanha tudo num console e pode assumir, devolver ao agent e encerrar o atendimento.

Stack sugerida no PRD: **TypeScript estrito + Next.js 16 + Mastra**, com Claude (Anthropic) como modelo.

## Como rodar

Pré-requisito: Node.js 22.13 ou superior (usa o SQLite nativo do Node, `node:sqlite`).

```bash
npm install
cp .env.example .env    # preencha ANTHROPIC_API_KEY
npm run dev
```

Abra http://localhost:3000. O login aceita qualquer senha para os e-mails de exemplo:

| Conta | Papel | Bom para testar |
|---|---|---|
| `ana.souza@nexo.com.br` | funcionária | VPN (abrir chamado), status de chamado vencido, transferência |
| `carla.mendes@nexo.com.br` | funcionária | reabrir chamado resolvido há 4 dias (SAP) |
| `rafael.lima@nexo.com.br` | analista N2 | console: assumir, responder, devolver, encerrar |

Outros comandos:

```bash
npm test            # testes (Vitest)
npm run typecheck   # tsc --noEmit
npm run lint
npm run reset       # apaga os bancos; o seed é recriado no próximo start
```

Os bancos ficam em `~/.nexo-assist` (configurável em `NEXO_DATA_DIR`). Eles ficam fora do projeto porque o watcher do Next em dev trata as escritas do SQLite como mudança de código e recarrega a página em loop.

### Roteiro de demonstração

1. **Ana:** "Meu notebook não conecta na VPN, erro 809".
   - O agent busca na central de ajuda e lê que o artigo vale só para Windows 10.
   - Pergunta quem é afetado (opções rápidas) e se há compromisso hoje.
   - Monta o rascunho com prioridade calculada pelas regras. O chamado só é criado em **Confirmar** (Ctrl+Enter).
2. **Ana:** "Qual o status do meu chamado?"
   - Seletor com os 3 chamados abertos.
   - O INC-20311 aparece **vencido** (sem atualização há 6 dias, prazo de 3 dias úteis).
   - O agent oferece "Falar com um analista".
3. **Ana:** "Quero falar com um analista". A conversa fica *aguardando atendente*, o agent é pausado e o analista recebe um resumo.
4. **Rafael** (em outra janela anônima): a conversa aparece em *Para você*. Ele clica em **Assumir**, responde, e a Ana vê a resposta em tempo real. Depois **Devolver ao agent** ou **Encerrar**.
5. **Carla:** "Meu SAP bloqueou de novo". O agent encontra o INC-20150, resolvido há 4 dias, e propõe **reabrir** em vez de abrir outro.
6. Clique em **Como decidi** abaixo de qualquer resposta para ver a intenção, a confiança, as tools com entrada e saída, os tokens e a latência.

## Arquitetura

```
src/
  app/                       Next.js: páginas e route handlers
    login, chat, perfil, console
    api/chat                 envia mensagem → resposta do agent em streaming (SSE)
    api/drafts/[id]/...      confirmar / cancelar rascunho (sem LLM)
    api/conversations/[id]/events   tempo real (SSE) para funcionário e analista
    api/console/...          ações do analista e chamados do funcionário
    api/service-desk/...     HTTP do serviço de chamados simulado
  service-desk/              Serviço de chamados simulado (chamados + central de ajuda)
  agent/                     Mastra: agent, tools, cliente HTTP do service desk
  domain/                    Regras puras: prioridade, SLA em horário útil, duplicidade
  server/                    Sessão, conversas, rascunhos e orquestração agent ↔ analista
  components/                UI (chat, cards, console)
```

```
 Navegador ──SSE──▶ server/chat ──▶ agent (Mastra + tools) ──HTTP──▶ service-desk ──▶ service-desk.db
     ▲                  │                    │
     └──SSE (eventos)───┴── app.db ◀─────────┘ (rascunhos, transferências)
```

As camadas e por que estão separadas assim:

- **O serviço de chamados é separado do agent.** Tem banco próprio, API HTTP própria e não importa nada do agent nem da UI. O agent fala com ele só pelo `ServiceDeskClient`, como falaria com o sistema legado real. Trocar o simulado por um real é trocar a URL (`SERVICE_DESK_URL`).
- **O sistema legado cai de vez em quando.** O serviço simula janelas de indisponibilidade de 5 s a cada 4 min, 5% de falhas aleatórias e latência. O cliente tem timeout de 4 s e 3 novas tentativas com backoff exponencial (0,4, 0,8 e 1,6 s). Se ainda assim falhar, a tool devolve `sistema_indisponivel` como dado, e o agent explica isso em vez de inventar. Na confirmação de um rascunho, o card continua lá para tentar de novo, e a chave de idempotência impede chamado duplicado.
- **Regras de negócio fora do prompt.** Prioridade (impacto × urgência), prazos em horário útil (seg–sex, 8h–18h; crítico 1 h corrida, com plantão), janela de reabertura de 7 dias e duplicidade são funções puras em `src/domain`, todas testadas. O LLM extrai os fatos (quem é afetado, se impede de trabalhar, se há compromisso hoje) e o código decide. Isso deixa a decisão auditável e estável entre execuções.
- **A UI não conhece o LLM.** Ela consome eventos (`steps`, `text`, `done`) e DTOs. O agent não conhece a UI: produz `parts` (cards) e um `trace`.

### Persistência

São dois bancos SQLite (`node:sqlite`, sem dependência nativa):

- **`app.db`:** usuários, conversas (estado `agent` → `waiting_human` → `human` → `closed`), mensagens com passos, cards e trace, e rascunhos.
- **`service-desk.db`:** chamados, comentários e artigos.

Tudo sobrevive a reinício. A conversa em andamento é retomada quando o funcionário volta ("voltar outro dia e continuar de onde parei").

## Como o agent decide

O agent (`src/agent/agent.ts`) tem instruções curtas e 9 tools:

| Tool | Para quê |
|---|---|
| `buscar_central_ajuda` | resolver sem fila; o agent precisa respeitar as condições do artigo |
| `listar_meus_chamados` / `consultar_chamado` | status, prazo e vencimento (calculado, não inventado) |
| `mostrar_seletor_chamados` / `oferecer_opcoes` | perguntas fechadas viram cliques (tela 3, opções rápidas) |
| `preparar_rascunho_chamado` | verifica duplicidade, classifica prioridade, calcula SLA e mostra o card; **não cria** |
| `preparar_atualizacao_chamado` | complementar ou reabrir (só se resolvido há até 7 dias) |
| `transferir_para_analista` | pedido do funcionário, caso crítico, prazo vencido ou falta de segurança; inclui um resumo para o analista |
| `registrar_decisao` | intenção, confiança (0–1) e justificativa, uma vez por resposta |

Garantias que não dependem do modelo obedecer:

- **Identidade e privacidade:**
  - O funcionário vem da sessão (cookie assinado com HMAC) e entra nas tools pelo `RequestContext` do Mastra. Nenhuma tool aceita "de quem" como parâmetro.
  - O serviço de chamados também valida o dono. Para um funcionário, um chamado alheio responde 404, como se não existisse.
- **Confirmação antes de agir:** criar ou atualizar chamado só acontece no clique em Confirmar, por uma rota determinística, sem LLM no caminho.
- **Baixa confiança:** se o agent registra confiança < 0,5 e não transfere, o servidor transfere ("Agent pediu ajuda · confiança 41%" no console).
- **Pausa:** com a conversa aguardando ou com um analista, o agent não roda; as mensagens do funcionário só são registradas.
- **Escopo e limites:** 30 mensagens por sessão, uma resposta por vez por conversa e no máximo 8 passos de tool por resposta.

## Transparência

- Acima de cada resposta aparecem os passos ("consultou seus chamados · classificou a prioridade · montou o rascunho").
- **Como decidi** abre um painel com:
  - o que o agent entendeu;
  - a confiança e o porquê;
  - cada tool com entrada, resultado e tempo;
  - o modelo, os tokens e a latência.
- O console do analista mostra o mesmo, além do resumo da transferência no topo da conversa.

## Modelo: por que Claude Haiku 5.5

O trabalho do agent é rotear, chamar tools e escrever respostas curtas. Ele não precisa de raciocínio longo. Haiku 5.5 tem baixa latência (a meta é responder rápido no chat), é bom em tool calling e custa uma fração dos modelos maiores, o que importa com 2.000 funcionários.

O modelo é configurável (`NEXO_MODEL`, formato do roteador de modelos do Mastra, ex.: `anthropic/claude-sonnet-5-5`).

Para economizar por conversa:

- histórico limitado às 20 últimas mensagens, com os cards resumidos em uma linha;
- prioridade e prazo calculados em código, sem gastar tokens;
- confirmação de rascunho sem chamada ao modelo;
- `temperature` 0,2 e `maxOutputTokens` 900.

## Qualidade

- **42 testes** (`npm test`):
  - regras de domínio (horário útil, SLA, prioridade, duplicidade);
  - serviço de chamados (privacidade, idempotência, validação, indisponibilidade);
  - tools do agent contra o serviço real em memória (identidade vinda da sessão, rascunho em vez de criação, bloqueio de duplicado, reabertura, transferência, retry);
  - orquestração (confirmação idempotente, rascunho de outra pessoa, transferência por baixa confiança, pausa e retomada do agent, limite de mensagens, falha do modelo).
- O LLM é substituído por um `runTurn` falso nos testes de orquestração. As decisões que importam estão em código testável.
- TypeScript `strict` com `noUncheckedIndexedAccess`; ESLint do Next.

## Trade-offs

- **SQLite e polling em vez de Postgres e pub/sub.**
  - Sobe com um comando e sem infraestrutura.
  - O tempo real é SSE com polling de 1 s no banco; para um processo só, é simples e suficiente.
  - Em produção com várias instâncias, eu trocaria por Postgres e LISTEN/NOTIFY (ou Redis).
- **Serviço de chamados dentro do mesmo app Next.** Fica separado por módulo, banco e HTTP, mas no mesmo processo, para manter "poucos comandos". Extrair para um serviço próprio não muda o agent.
- **Duplicidade por similaridade léxica.** É explicável e determinística, e o agent confirma com o funcionário. Embeddings melhorariam paráfrases ("internet caiu" × "sem rede").
- **Histórico do LLM montado a partir do banco do app,** em vez da memória do Mastra: uma fonte de verdade só, e controle do que vai para o prompt.
- **Login simulado** (qualquer senha para e-mails do seed), como pede o PRD. Em produção, seria SSO corporativo.

## O que eu faria com mais tempo

- Avaliações automáticas do agent com cenários (VPN, vencido, duplicado, fora de escopo, prompt injection), medindo a escolha de tools e a transferência correta. Rodariam no CI com o modelo real.
- Feriados no cálculo de horário útil e prazos por fila (N1/N2).
- Notificações (e-mail/Teams) quando o analista assume ou responde e o funcionário não está na tela.
- Métricas no console: tempo até a primeira resposta, % resolvido sem fila, transferências por motivo.
- Deploy com Postgres, rate limit por usuário no gateway e limite de gasto no provedor do modelo.
- Acessibilidade revisada com leitor de tela e layout mobile completo do console.
