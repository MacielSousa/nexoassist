import type { Affected, Category, Priority, TicketStatus, TicketType } from "../domain/ticketRules";

export interface ICreateTicketDTO {
  number: string;
  type: TicketType;
  title: string;
  description: string;
  category: Category;
  priority: Priority;
  priorityReason: string;
  status: TicketStatus;
  affected: Affected;
  requesterId: string;
  assignedGroup: string | null;
  idempotencyKey: string | null;
}

export interface IListTicketsFilter {
  requesterId?: string;
  status?: TicketStatus[];
  search?: string;
  limit?: number;
}
