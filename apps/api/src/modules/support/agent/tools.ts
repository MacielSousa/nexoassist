import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { SUPPORT_TEAMS } from "@modules/accounts/dtos/UserRole";
import { findDuplicates } from "@modules/tickets/domain/similarity";
import { AFFECTED, CATEGORIES, classifyPriority, SEVERITIES, SLA_LABEL, slaDeadline, TICKET_TYPES } from "@modules/tickets/domain/ticketRules";
import { ServiceDeskUnavailableError } from "@modules/tickets/providers/ServiceDeskProvider/IServiceDeskProvider";
import { AppError } from "@shared/errors/AppError";
import { HANDOFF_REASONS, type TicketCard } from "../dtos/supportTypes";
import type { ITurnContext } from "./TurnContext";

// Tools do Nexo Assist. Cada tool:
// - lê a identidade do funcionário do contexto do turno (nunca de um parâmetro do LLM);
// - registra o que fez (passos e trace) para a transparência;
// - devolve erros como dados, para o agent explicar ao funcionário em vez de inventar.

const TICKET_NUMBER = /^(INC|REQ)-\d+$/i;

function turn(context: { requestContext?: { get: (key: string) => unknown } }): ITurnContext {
  const ctx = context.requestContext?.get("turn") as ITurnContext | undefined;
  if (!ctx) throw new Error("Contexto do turno ausente.");
  return ctx;
}

async function safe<T>(run: () => Promise<T>): Promise<T | { erro: string }> {
  try {
    return await run();
  } catch (err) {
    if (err instanceof ServiceDeskUnavailableError) {
      return { erro: "sistema_indisponivel: o sistema de chamados não respondeu após novas tentativas. Peça para tentar de novo em instantes." };
    }
    if (err instanceof AppError) return { erro: err.message };
    throw err;
  }
}

const card = ({ comments: _comments, ...ticket }: TicketCard & { comments?: unknown }): TicketCard => ticket;

export const searchKnowledgeBase = createTool({
  id: "buscar_central_ajuda",
  description:
    "Busca artigos na central de ajuda. Use antes de abrir chamado para dúvidas e problemas comuns. Leia as condições do artigo (ex.: versão do Windows) antes de recomendá-lo.",
  inputSchema: z.object({ consulta: z.string().min(2).describe("Palavras-chave do problema, ex.: 'vpn erro 809'") }),
  execute: async (input, context) => {
    const ctx = turn(context);
    ctx.recorder.step("buscou na central de ajuda");
    return safe(() =>
      ctx.recorder.trace("buscar_central_ajuda", "buscou na central de ajuda", input, async () => {
        const articles = await ctx.serviceDesk.searchArticles(input.consulta);
        if (articles.length) ctx.recorder.part({ kind: "articles", articles: articles.map(({ code, title }) => ({ code, title })) });
        return { artigos: articles.map(({ code, title, body }) => ({ codigo: code, titulo: title, conteudo: body })) };
      }),
    );
  },
});

export const listMyTickets = createTool({
  id: "listar_meus_chamados",
  description: "Lista os chamados do funcionário, com status, prazo (SLA) e se está vencido. Use para status, para evitar duplicidade e antes de abrir chamado.",
  inputSchema: z.object({ incluir_encerrados: z.boolean().default(false).describe("Inclui resolvidos e fechados") }),
  execute: async (input, context) => {
    const ctx = turn(context);
    ctx.recorder.step("consultou seus chamados");
    return safe(() =>
      ctx.recorder.trace("listar_meus_chamados", "consultou seus chamados", input, async () => {
        const tickets = await ctx.serviceDesk.listTickets(ctx.actor, input.incluir_encerrados ? "all" : "open");
        for (const t of tickets) ctx.recorder.seenTickets.set(t.number, card(t));
        return {
          chamados: tickets.map((t) => ({
            numero: t.number,
            titulo: t.title,
            categoria: t.category,
            prioridade: t.priority,
            status: t.statusLabel,
            ultima_atualizacao: t.updatedAt,
            prazo: t.slaLabel,
            vencido: t.overdue,
            pode_reabrir: t.canReopen,
          })),
        };
      }),
    );
  },
});

export const getTicket = createTool({
  id: "consultar_chamado",
  description: "Consulta um chamado do funcionário pelo número e mostra o card do chamado na conversa, com o prazo calculado.",
  inputSchema: z.object({ numero: z.string().regex(TICKET_NUMBER).describe("Ex.: INC-20311") }),
  execute: async (input, context) => {
    const ctx = turn(context);
    const numero = input.numero.toUpperCase();
    ctx.recorder.step(`consultou o ${numero}`);
    return safe(() =>
      ctx.recorder.trace("consultar_chamado", `consultou o ${numero}`, input, async () => {
        const t = await ctx.serviceDesk.getTicket(ctx.actor, numero);
        if (!t) return { erro: "Chamado não encontrado entre os chamados deste funcionário." };
        ctx.recorder.step("calculou o prazo");
        ctx.recorder.part({ kind: "ticket", ticket: card(t) });
        return {
          numero: t.number,
          titulo: t.title,
          descricao: t.description,
          categoria: t.category,
          prioridade: t.priority,
          status: t.statusLabel,
          aberto_em: t.createdAt,
          ultima_atualizacao: t.updatedAt,
          prazo: t.slaLabel,
          vencido: t.overdue,
          pode_reabrir: t.canReopen,
          ultimos_comentarios: t.comments?.slice(-3).map((c) => ({ autor: c.authorName, texto: c.body, em: c.createdAt })),
        };
      }),
    );
  },
});

export const showTicketSelector = createTool({
  id: "mostrar_seletor_chamados",
  description: "Mostra um seletor para o funcionário escolher um dos chamados dele, quando não está claro de qual ele fala. Chame depois de listar_meus_chamados.",
  inputSchema: z.object({ numeros: z.array(z.string()).min(2).max(8) }),
  execute: async (input, context) => {
    const ctx = turn(context);
    const tickets = input.numeros.map((n) => ctx.recorder.seenTickets.get(n.toUpperCase())).filter((t) => t !== undefined);
    if (tickets.length < 2) return { erro: "Liste os chamados antes com listar_meus_chamados." };
    ctx.recorder.part({
      kind: "ticket_selector",
      tickets: tickets.map(({ number, title, status, statusLabel, updatedAt }) => ({ number, title, status, statusLabel, updatedAt })),
    });
    return { mostrado: true };
  },
});

export const offerOptions = createTool({
  id: "oferecer_opcoes",
  description: "Mostra botões de resposta rápida para uma pergunta fechada (ex.: quem está sendo afetado). O funcionário ainda pode digitar livremente.",
  inputSchema: z.object({ pergunta: z.string().min(3), opcoes: z.array(z.string().min(1).max(40)).min(2).max(4) }),
  execute: async (input, context) => {
    turn(context).recorder.part({ kind: "options", question: input.pergunta, options: input.opcoes });
    return { mostrado: true };
  },
});

export const prepareTicketDraft = createTool({
  id: "preparar_rascunho_chamado",
  description: [
    "Monta o rascunho de um NOVO chamado para o funcionário conferir. Não cria o chamado: ele só é criado quando o funcionário confirma no card.",
    "A prioridade e o prazo são calculados pelas regras do service desk a partir de 'afetados', 'severidade' e 'compromisso_hoje' — extraia esses fatos da conversa; se faltar algum, pergunte antes.",
    "Verifica duplicidade: se já houver chamado aberto (ou resolvido há até 7 dias) sobre o mesmo problema, devolve os candidatos e NÃO cria rascunho; proponha atualizar/reabrir.",
  ].join(" "),
  inputSchema: z.object({
    tipo: z.enum(TICKET_TYPES).describe("INC quando algo parou ou não funciona; REQ para pedido de acesso, equipamento ou software"),
    categoria: z.enum(CATEGORIES),
    titulo: z.string().min(5).max(90).describe("Curto e específico, ex.: 'VPN não conecta no notebook — erro 809'"),
    descricao: z.string().min(10).max(600).describe("O que acontece, desde quando, o que já tentou, ambiente (ex.: Windows 11)"),
    afetados: z.enum(AFFECTED).describe("individual = só a pessoa; equipe; empresa"),
    severidade: z.enum(SEVERITIES).describe("parado = nada funciona; impede_trabalho = não consegue trabalhar; atrapalha = há alternativa; sem_urgencia = pedido/melhoria"),
    compromisso_hoje: z.boolean().describe("Há reunião, entrega ou cliente hoje dependendo da solução"),
    ignorar_duplicidade: z.boolean().default(false).describe("Só true se o funcionário confirmou que é um problema diferente do chamado existente"),
  }),
  execute: async (input, context) => {
    const ctx = turn(context);
    return safe(() =>
      ctx.recorder.trace("preparar_rascunho_chamado", "montou o rascunho", input, async () => {
        if (!input.ignorar_duplicidade) {
          ctx.recorder.step("verificou duplicidade");
          const tickets = await ctx.serviceDesk.listTickets(ctx.actor, "all");
          const duplicates = findDuplicates(
            { category: input.categoria, title: input.titulo, description: input.descricao },
            tickets.map((t) => ({ ...t, resolvedAt: t.resolvedAt ? new Date(t.resolvedAt) : null })),
            ctx.now,
          );
          if (duplicates.length) {
            for (const t of tickets) ctx.recorder.seenTickets.set(t.number, card(t));
            return {
              rascunho_criado: false,
              motivo: "Já existe chamado sobre o mesmo problema. Proponha atualizar (aberto) ou reabrir (resolvido há até 7 dias).",
              candidatos: duplicates.slice(0, 3),
            };
          }
        }

        ctx.recorder.step("classificou a prioridade");
        const { priority, reason } = classifyPriority({ affected: input.afetados, severity: input.severidade, sameDayCommitment: input.compromisso_hoje });
        ctx.recorder.step("consultou o SLA");
        const deadline = slaDeadline(priority, ctx.now);
        ctx.recorder.step("montou o rascunho");
        const draft = await ctx.createDraft({
          kind: "create",
          type: input.tipo,
          title: input.titulo,
          description: input.descricao,
          category: input.categoria,
          affected: input.afetados,
          severity: input.severidade,
          sameDayCommitment: input.compromisso_hoje,
          priority,
          priorityReason: reason,
          slaLabel: SLA_LABEL[priority],
          deadline: deadline.toISOString(),
        });
        ctx.recorder.part({ kind: "draft", draftId: draft.id });
        return {
          rascunho_criado: true,
          rascunho: draft.id,
          prioridade: priority,
          justificativa_prioridade: reason,
          prazo: SLA_LABEL[priority],
          prazo_ate: deadline.toISOString(),
          instrucao: "O card de confirmação já está visível. Explique a prioridade em uma frase e peça para conferir.",
        };
      }),
    );
  },
});

export const prepareTicketUpdate = createTool({
  id: "preparar_atualizacao_chamado",
  description:
    "Monta o rascunho de uma atualização (nova informação) num chamado existente do funcionário, ou a reabertura de um chamado resolvido há até 7 dias. Só é aplicado depois da confirmação no card.",
  inputSchema: z.object({
    numero: z.string().regex(TICKET_NUMBER),
    comentario: z.string().min(5).max(800).describe("A informação nova, escrita para o analista"),
    reabrir: z.boolean().default(false),
  }),
  execute: async (input, context) => {
    const ctx = turn(context);
    const numero = input.numero.toUpperCase();
    return safe(() =>
      ctx.recorder.trace("preparar_atualizacao_chamado", "montou a atualização", input, async () => {
        const t = await ctx.serviceDesk.getTicket(ctx.actor, numero);
        if (!t) return { erro: "Chamado não encontrado entre os chamados deste funcionário." };
        if (input.reabrir && !t.canReopen) return { erro: "Esse chamado não pode ser reaberto (só resolvidos há até 7 dias). Proponha um novo chamado." };
        const open = !["resolvido", "fechado"].includes(t.status);
        if (!input.reabrir && !open) return { erro: "Esse chamado está encerrado. Se foi resolvido há até 7 dias, use reabrir=true; senão, abra um novo." };

        ctx.recorder.step(input.reabrir ? `preparou a reabertura do ${numero}` : `preparou a atualização do ${numero}`);
        const draft = await ctx.createDraft({
          kind: "update",
          type: t.type,
          title: t.title,
          description: t.description,
          category: t.category,
          affected: t.affected,
          priority: t.priority,
          priorityReason: "Mantida a prioridade do chamado.",
          slaLabel: t.slaLabel,
          deadline: slaDeadline(t.priority, ctx.now).toISOString(),
          ticketNumber: numero,
          comment: input.comentario,
          reopen: input.reabrir,
        });
        ctx.recorder.part({ kind: "draft", draftId: draft.id });
        return { rascunho_criado: true, rascunho: draft.id, instrucao: "O card de confirmação já está visível. Peça para conferir." };
      }),
    );
  },
});

export const transferToAnalyst = createTool({
  id: "transferir_para_analista",
  description: [
    "Transfere a conversa para um analista humano e pausa o agent.",
    "Use quando: o funcionário pede; o caso é crítico; um chamado está vencido e ele quer ajuda; ou você não tem segurança sobre o que fazer.",
    "Escreva um resumo que permita ao analista agir sem perguntar tudo de novo.",
  ].join(" "),
  inputSchema: z.object({
    motivo: z.enum(HANDOFF_REASONS),
    resumo: z.string().min(20).max(700).describe("Problema, o que já foi tentado, chamado relacionado e o que o funcionário espera"),
    numero_chamado: z.string().regex(TICKET_NUMBER).optional(),
    nivel: z.enum(SUPPORT_TEAMS).default("Suporte N1").describe("N2 para casos vencidos, recorrentes ou técnicos"),
    confianca: z.number().min(0).max(1).optional(),
  }),
  execute: async (input, context) => {
    const ctx = turn(context);
    ctx.recorder.step("transferiu para um analista");
    return safe(() =>
      ctx.recorder.trace("transferir_para_analista", "transferiu para um analista", input, async () => {
        const numero = input.numero_chamado?.toUpperCase();
        if (numero) await ctx.serviceDesk.transfer(ctx.actor, numero, input.nivel, input.resumo);
        const handoff = { reason: input.motivo, summary: input.resumo, ticketNumber: numero, group: input.nivel, confidence: input.confianca };
        await ctx.requestHandoff(handoff);
        ctx.recorder.handoff = handoff;
        return {
          transferido: true,
          grupo: input.nivel,
          previsao_contato: input.nivel === "Suporte N2" ? "2 h úteis" : "4 h úteis",
          instrucao: "Avise que um analista vai continuar por aqui.",
        };
      }),
    );
  },
});

export const recordDecision = createTool({
  id: "registrar_decisao",
  description:
    "Registra, uma vez por resposta, o que você entendeu e quão seguro está. Chame antes da resposta final. Confiança abaixo de 0.5 significa que um analista deve assumir.",
  inputSchema: z.object({
    intencao: z.string().min(3).max(120).describe("Ex.: 'abrir chamado de VPN', 'consultar status do INC-20311', 'dúvida de horário'"),
    confianca: z.number().min(0).max(1),
    justificativa: z.string().min(3).max(300).describe("Por que escolheu essa ação, citando regra ou dado usado"),
  }),
  execute: async (input, context) => {
    turn(context).recorder.decision = { intent: input.intencao, confidence: input.confianca, rationale: input.justificativa };
    return { registrado: true };
  },
});

export const nexoTools = {
  searchKnowledgeBase,
  listMyTickets,
  getTicket,
  showTicketSelector,
  offerOptions,
  prepareTicketDraft,
  prepareTicketUpdate,
  transferToAnalyst,
  recordDecision,
};
