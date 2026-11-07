import { inject, injectable } from "tsyringe";
import type { IActor } from "@modules/accounts/dtos/IActor";
import type { IServiceDeskProvider } from "@modules/tickets/providers/ServiceDeskProvider/IServiceDeskProvider";
import type { ITurnTrace } from "@modules/support/dtos/supportTypes";
import type { ISnapshotResponseDTO } from "@modules/support/mapper/ConversationMap";
import type { IConversationsRepository } from "@modules/support/repositories/IConversationsRepository";
import type { IDraftsRepository } from "@modules/support/repositories/IDraftsRepository";
import { ConversationSnapshot } from "@modules/support/services/ConversationSnapshot";
import { ConversationTimeline } from "@modules/support/services/ConversationTimeline";
import { AppError } from "@shared/errors/AppError";
import type { Draft } from "@modules/support/infra/typeorm/entities/Draft";

const formatWhen = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

/** Rascunho pendente do próprio funcionário, numa conversa ainda aberta. */
export async function findPendingDraft(drafts: IDraftsRepository, conversations: IConversationsRepository, actor: IActor, id: string): Promise<Draft> {
  const draft = await drafts.findById(id);
  if (!draft || draft.employeeId !== actor.id) throw new AppError("Rascunho não encontrado.", 404);
  if (draft.status !== "pending") throw new AppError("Esse rascunho já foi resolvido.", 409);
  const conversation = await conversations.findById(draft.conversationId);
  if (!conversation || conversation.status === "closed") throw new AppError("Essa conversa foi encerrada.", 409);
  return draft;
}

/**
 * O funcionário clicou em Confirmar: cria (ou atualiza) o chamado de forma determinística,
 * sem LLM no caminho. O id do rascunho é a chave de idempotência: clique duplo não duplica.
 */
@injectable()
export class ConfirmDraftUseCase {
  constructor(
    @inject("DraftsRepository") private drafts: IDraftsRepository,
    @inject("ConversationsRepository") private conversations: IConversationsRepository,
    @inject("ServiceDeskProvider") private serviceDesk: IServiceDeskProvider,
    @inject(ConversationTimeline) private timeline: ConversationTimeline,
    @inject(ConversationSnapshot) private snapshot: ConversationSnapshot,
  ) {}

  async execute({ actor, draftId }: { actor: IActor; draftId: string }): Promise<ISnapshotResponseDTO> {
    const draft = await findPendingDraft(this.drafts, this.conversations, actor, draftId);
    const p = draft.payload;
    const started = Date.now();

    // ServiceDeskUnavailableError (503) sobe para o cliente: o rascunho continua pendente para tentar de novo.
    const ticket =
      p.kind === "create"
        ? await this.serviceDesk.createTicket(
            actor,
            { type: p.type, title: p.title, description: p.description, category: p.category, affected: p.affected, severity: p.severity!, sameDayCommitment: p.sameDayCommitment ?? false },
            draft.id,
          )
        : await this.serviceDesk.addComment(actor, p.ticketNumber!, p.comment!, p.reopen ?? false);

    await this.drafts.updateStatus(draft.id, "confirmed", ticket.number);

    const label = p.kind === "create" ? "criou o chamado" : p.reopen ? "reabriu o chamado" : "atualizou o chamado";
    const content =
      p.kind === "create"
        ? `Pronto: abri o ${ticket.number} com prioridade ${ticket.priority.toLowerCase()}. A primeira resposta chega até ${formatWhen(ticket.deadline)}.`
        : p.reopen
          ? `Reabri o ${ticket.number} com a nova informação. A equipe responde até ${formatWhen(ticket.deadline)}.`
          : `Atualizei o ${ticket.number} com a nova informação.`;
    const trace: ITurnTrace = {
      decision: { intent: label, confidence: 1, rationale: `Confirmado pelo funcionário no rascunho ${draft.id}.` },
      tools: [{ tool: p.kind === "create" ? "criar_chamado" : "atualizar_chamado", label, input: { rascunho: draft.id }, output: { numero: ticket.number }, ok: true, ms: Date.now() - started }],
      model: "—",
      latencyMs: Date.now() - started,
      usage: { inputTokens: 0, outputTokens: 0 },
    };
    const { comments: _comments, ...card } = ticket;
    await this.timeline.post({ conversationId: draft.conversationId, role: "assistant", content, steps: [label], parts: [{ kind: "ticket", ticket: card }], trace });
    return this.snapshot.build(draft.conversationId);
  }
}
