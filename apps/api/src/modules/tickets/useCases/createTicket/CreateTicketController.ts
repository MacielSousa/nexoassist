import type { Request, Response } from "express";
import { container } from "tsyringe";
import { z } from "zod";
import { AFFECTED, CATEGORIES, SEVERITIES, TICKET_TYPES } from "@modules/tickets/domain/ticketRules";
import { CreateTicketUseCase } from "./CreateTicketUseCase";

export class CreateTicketController {
  static body = z
    .object({
      type: z.enum(TICKET_TYPES).meta({ description: "INC = algo parou; REQ = pedido de acesso, equipamento ou software" }),
      title: z.string().trim().min(5).max(120).meta({ example: "VPN não conecta no notebook — erro 809" }),
      description: z.string().trim().min(10).max(2000),
      category: z.enum(CATEGORIES),
      affected: z.enum(AFFECTED),
      severity: z.enum(SEVERITIES).meta({ description: "Usado com affected e sameDayCommitment para calcular a prioridade" }),
      sameDayCommitment: z.boolean().default(false),
    })
    .meta({ id: "CreateTicket" });

  async handle(request: Request, response: Response): Promise<Response> {
    const data = CreateTicketController.body.parse(request.body);
    const idempotencyKey = request.header("Idempotency-Key") ?? undefined;
    const ticket = await container.resolve(CreateTicketUseCase).execute({ actor: request.user, data, idempotencyKey });
    return response.status(201).json(ticket);
  }
}
