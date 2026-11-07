# Plano de ação: Nexo Assist

Fonte: PRD "Desafio Técnico: Nexo Assist, o agent do service desk de TI" (v5) e protótipo `nexo.pen` (Anexo C).

## Objetivo

Um agent de chat que resolve dúvidas pela central de ajuda, consulta, abre e atualiza chamados sem duplicar, classifica a prioridade pelas regras do service desk e transfere para um analista quando precisa. Tudo de forma transparente: cada resposta mostra o que o agent fez e por quê.

## Arquitetura

Stack sugerida no PRD: **TypeScript estrito + Next.js + Mastra**, num único projeto e com um comando para rodar.

```
src/
  app/                       Next.js: páginas (login, chat, perfil, console) e route handlers
    api/service-desk/...     HTTP do serviço de chamados simulado (só fala com service-desk/)
  service-desk/              Serviço de chamados simulado: chamados + central de ajuda, seed (Anexo B),
                             indisponibilidade simulada do sistema legado. Não conhece o agent.
  agent/                     Mastra: agent, tools e cliente HTTP do service desk (timeout, retry, backoff)
  domain/                    Regras puras: prioridade, SLA em horário útil, duplicidade, tipos e schemas
  server/                    Auth, conversas e orquestração do atendimento (agent ↔ analista)
  components/                UI seguindo o protótipo
```

- **Separação:** a interface não conhece o LLM. O agent não acessa banco: fala com o serviço de chamados por HTTP (`/api/service-desk`) através de um cliente com timeout, retry e backoff. As regras de negócio (prioridade, prazos, duplicidade) são funções puras e testadas, em vez de ficarem escondidas no prompt.
- **Persistência:**
  - SQLite nativo do Node (`node:sqlite`, sem dependência extra) em dois arquivos independentes: `data/app.db` guarda usuários, conversas, mensagens, rascunhos e o estado de cada conversa; `data/service-desk.db` guarda chamados e artigos.
  - Os dois sobrevivem a reinício.
- **Privacidade:**
  - O id do funcionário vem da sessão (cookie assinado com HMAC) e é injetado no contexto das tools. O LLM nunca escolhe de quem são os chamados.
  - O serviço também valida o dono de cada chamado (defesa em profundidade).
- **Segurança:** as chaves ficam no `.env` (fora do git), o serviço exige token interno, há limite de 30 mensagens por sessão e uma resposta por vez por conversa.

## Como o agent decide

1. Lê a mensagem e o histórico recente da conversa.
2. Usa as tools:
   - `buscar_central_ajuda`
   - `listar_meus_chamados` e `consultar_chamado`
   - `verificar_duplicidade`
   - `preparar_rascunho` (abertura ou atualização)
   - `oferecer_opcoes` e `escolher_chamado`
   - `transferir_para_analista`
   - `registrar_decisao`
3. A prioridade é calculada por `packages/domain`, a partir de impacto, bloqueio e compromisso no mesmo dia. O LLM só extrai os fatos.
4. Nunca cria nem atualiza um chamado sem confirmação. O agent monta um rascunho (card) e a criação acontece de forma determinística quando o funcionário clica em **Confirmar**, com uma chave de idempotência.
5. Duplicidade:
   - Se já existe um chamado aberto sobre o mesmo problema, o agent propõe atualizar esse chamado.
   - Se o chamado foi resolvido há até 7 dias, propõe reabrir.
6. Transferência acontece quando:
   - o funcionário pede;
   - o caso é crítico;
   - o chamado está vencido e o funcionário quer um analista;
   - a confiança do agent é baixa (< 0,5).
   
   A conversa fica "aguardando atendente", o agent é pausado e o analista recebe um resumo.
7. Escopo: só assuntos de TI. RH, financeiro e facilities são redirecionados.

## Transparência

- Acima de cada resposta aparecem chips com as ações ("consultou seus chamados", "classificou a prioridade").
- Um painel expansível mostra:
  - intenção entendida;
  - tools chamadas, com entrada e saída resumidas;
  - confiança e justificativa;
  - modelo, tokens e latência.

## Telas (Anexo C)

1. Login
2. Chat: novo chamado
3. Chat: consulta e transferência
4. Console: conversas
5. Console: atendimento assumido
6. Meu perfil

## Etapas e commits

1. Scaffold do projeto Next.js, tooling (TS estrito, Vitest, ESLint) e plano.
2. `src/domain`: horário útil, SLA, matriz de prioridade, duplicidade, tipos e testes.
3. `src/service-desk` + `/api/service-desk`: seed (Anexo B), indisponibilidade simulada e testes.
4. `src/agent`: cliente com retry, tools, agent Mastra e testes das tools.
5. `src/server`: auth, banco, conversas e API de chat com streaming.
6. UI do funcionário: login, chat, cards, rascunho, seletor, transparência e perfil.
7. Console do analista: lista com filtros, histórico, assumir, devolver, encerrar e painel de chamados.
8. README com arquitetura, decisões, trade-offs e o que faria com mais tempo, mais `.env.example` e verificação ponta a ponta.

## Modelo

Anthropic `claude-haiku-5-5`: baixa latência e custo por conversa, e bom em tool calling. O modelo é configurável via `NEXO_MODEL`.
