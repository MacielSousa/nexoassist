import { z } from "zod";
import { avatarUrlOf, initialsOf } from "@modules/accounts/mapper/UserMap";
import { FileResponseSchema } from "@modules/files/mapper/FileMap";
import { addBusinessHours } from "@modules/tickets/domain/businessHours";
import { CONVERSATION_STATUSES, HANDOFF_REASON_LABEL, HANDOFF_REASONS, MESSAGE_LIMIT, MESSAGE_ROLES } from "../dtos/supportTypes";
import type { Conversation } from "../infra/typeorm/entities/Conversation";
import type { Draft } from "../infra/typeorm/entities/Draft";
import type { Message } from "../infra/typeorm/entities/Message";

// ---- Schemas das respostas (também alimentam o Swagger) ----

export const ConversationResponseSchema = z
  .object({
    id: z.uuid(),
    employee: z.object({ id: z.uuid(), name: z.string(), email: z.string(), department: z.string(), initials: z.string(), avatarUrl: z.string().nullable() }),
    status: z.enum(CONVERSATION_STATUSES).meta({ description: "agent → waiting_human → human → closed" }),
    assignedAnalyst: z.object({ id: z.uuid(), name: z.string() }).nullable(),
    handoff: z
      .object({
        reason: z.enum(HANDOFF_REASONS),
        reasonLabel: z.string(),
        summary: z.string(),
        ticket: z.string().nullable(),
        group: z.string(),
        confidence: z.number().nullable(),
        at: z.iso.datetime(),
        contactBy: z.iso.datetime().meta({ description: "Prazo para um analista assumir" }),
      })
      .nullable(),
    resolvedBy: z.enum(["agent", "analyst"]).nullable(),
    userMessageCount: z.number(),
    messageLimit: z.number(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .meta({ id: "Conversation" });

export const MessageResponseSchema = z
  .object({
    id: z.number(),
    role: z.enum(MESSAGE_ROLES),
    author: z.object({ id: z.string(), name: z.string() }).nullable(),
    content: z.string(),
    steps: z.array(z.string()).meta({ description: "Ações do agent nesta resposta" }),
    parts: z.array(z.any()).meta({ description: "Cards: options, ticket_selector, ticket, draft, articles" }),
    attachments: z.array(FileResponseSchema),
    trace: z.any().nullable().meta({ description: "Como decidi: intenção, confiança, tools, tokens e latência" }),
    createdAt: z.iso.datetime(),
  })
  .meta({ id: "Message" });

export const DraftResponseSchema = z
  .object({ id: z.string(), status: z.string(), resultTicket: z.string().nullable() })
  .catchall(z.any())
  .meta({ id: "Draft", description: "Rascunho de chamado aguardando confirmação (campos do chamado + prioridade calculada)" });

export const SnapshotResponseSchema = z
  .object({ conversation: ConversationResponseSchema, messages: z.array(MessageResponseSchema), drafts: z.record(z.string(), DraftResponseSchema) })
  .meta({ id: "ConversationSnapshot" });

export type IConversationResponseDTO = z.infer<typeof ConversationResponseSchema>;
export type IMessageResponseDTO = z.infer<typeof MessageResponseSchema>;
export type IDraftResponseDTO = z.infer<typeof DraftResponseSchema>;
export type ISnapshotResponseDTO = z.infer<typeof SnapshotResponseSchema>;

/** Tempo para um analista assumir depois da transferência. */
const CONTACT_HOURS = { "Suporte N1": 4, "Suporte N2": 2 } as const;

export class ConversationMap {
  static toDTO(c: Conversation, userMessageCount: number): IConversationResponseDTO {
    return {
      id: c.id,
      employee: { id: c.employee.id, name: c.employee.name, email: c.employee.email, department: c.employee.department, initials: initialsOf(c.employee.name), avatarUrl: avatarUrlOf(c.employee.avatarFileId) },
      status: c.status,
      assignedAnalyst: c.assignedAnalyst ? { id: c.assignedAnalyst.id, name: c.assignedAnalyst.name } : null,
      handoff:
        c.handoffReason && c.handoffAt
          ? {
              reason: c.handoffReason,
              reasonLabel: HANDOFF_REASON_LABEL[c.handoffReason],
              summary: c.handoffSummary ?? "",
              ticket: c.handoffTicket,
              group: c.handoffGroup ?? "Suporte N1",
              confidence: c.handoffConfidence,
              at: c.handoffAt.toISOString(),
              contactBy: addBusinessHours(c.handoffAt, CONTACT_HOURS[c.handoffGroup ?? "Suporte N1"]).toISOString(),
            }
          : null,
      resolvedBy: c.resolvedBy,
      userMessageCount,
      messageLimit: MESSAGE_LIMIT,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    };
  }

  static messageToDTO(m: Message): IMessageResponseDTO {
    return {
      id: m.id,
      role: m.role,
      author: m.authorId ? { id: m.authorId, name: m.authorName ?? "" } : null,
      content: m.content,
      steps: m.steps,
      parts: m.parts,
      attachments: m.attachments ?? [],
      trace: m.trace,
      createdAt: m.createdAt.toISOString(),
    };
  }

  static draftToDTO(d: Draft): IDraftResponseDTO {
    return { ...d.payload, id: d.id, status: d.status, resultTicket: d.resultTicket };
  }
}
