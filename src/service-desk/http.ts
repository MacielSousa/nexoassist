import { z } from "zod";
import { newTicketSchema, STATUSES, type Ticket } from "@/domain";
import type { ServiceDeskRepository } from "./repository";

// API HTTP do serviço de chamados simulado. Não conhece o agent nem a interface:
// qualquer cliente fala com ela por HTTP, com um token de serviço e a identidade de quem age.
//
// O sistema real é legado e "de vez em quando fica indisponível por alguns segundos".
// Simulamos isso com janelas periódicas de indisponibilidade, falhas aleatórias e latência.

export interface ChaosOptions {
  /** Probabilidade de uma requisição falhar com 503 (0 a 1). */
  failureRate: number;
  /** A cada `periodSec` segundos, o serviço fica fora por `downSec` segundos. */
  outage: { periodSec: number; downSec: number } | null;
  latencyMs: [number, number];
}

export interface ServiceDeskOptions {
  repo: ServiceDeskRepository;
  token: string;
  chaos: ChaosOptions;
  now?: () => Date;
  random?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

type Role = "employee" | "analyst";
interface Actor {
  id: string;
  role: Role;
}

class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  Response.json(body, { status, headers });

/** Fim de uma indisponibilidade forçada (demo), compartilhado pelo processo. */
let forcedOutageUntil = 0;

function unavailable(opts: ServiceDeskOptions, now: Date): boolean {
  if (now.getTime() < forcedOutageUntil) return true;
  const { outage, failureRate } = opts.chaos;
  if (outage) {
    const second = Math.floor(now.getTime() / 1000) % outage.periodSec;
    if (second < outage.downSec) return true;
  }
  return (opts.random ?? Math.random)() < failureRate;
}

function actorFrom(req: Request): Actor {
  const id = req.headers.get("x-actor-id");
  const role = req.headers.get("x-actor-role");
  if (!id || (role !== "employee" && role !== "analyst")) {
    throw new HttpError(400, "actor_required", "Informe x-actor-id e x-actor-role.");
  }
  return { id, role };
}

/** Funcionários só enxergam os próprios chamados. Para eles, um chamado alheio "não existe". */
function ensureVisible(ticket: Ticket | null, actor: Actor): Ticket {
  if (!ticket || (actor.role === "employee" && ticket.requesterId !== actor.id)) {
    throw new HttpError(404, "ticket_not_found", "Chamado não encontrado.");
  }
  return ticket;
}

async function body<T>(req: Request, schema: z.ZodType<T>): Promise<T> {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) throw new HttpError(422, "invalid_body", z.prettifyError(parsed.error));
  return parsed.data;
}

export async function handleServiceDesk(req: Request, path: string[], opts: ServiceDeskOptions): Promise<Response> {
  const now = (opts.now ?? (() => new Date()))();
  const sleep = opts.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const [min, max] = opts.chaos.latencyMs;
  if (max > 0) await sleep(min + Math.round((opts.random ?? Math.random)() * (max - min)));

  const method = req.method.toUpperCase();
  const route = path.join("/");

  if (route === "health") return json(200, { ok: !unavailable(opts, now) });

  if (req.headers.get("x-service-token") !== opts.token) {
    return json(401, { error: { code: "unauthorized", message: "Token de serviço inválido." } });
  }

  if (method === "POST" && route === "admin/outage") {
    const { seconds } = await body(req, z.object({ seconds: z.number().int().min(1).max(120) }));
    forcedOutageUntil = now.getTime() + seconds * 1000;
    return json(200, { until: new Date(forcedOutageUntil).toISOString() });
  }

  if (unavailable(opts, now)) {
    return json(503, { error: { code: "unavailable", message: "Sistema de chamados indisponível." } }, { "retry-after": "2" });
  }

  try {
    const actor = actorFrom(req);
    const { repo } = opts;
    const [resource, id, action] = path;

    if (resource === "kb" && id === "search" && method === "GET") {
      const q = new URL(req.url).searchParams.get("q") ?? "";
      return json(200, { articles: repo.searchArticles(q) });
    }

    if (resource !== "tickets") throw new HttpError(404, "not_found", "Rota inexistente.");

    if (!id) {
      if (method === "GET") {
        const params = new URL(req.url).searchParams;
        const requester = params.get("requester") ?? actor.id;
        if (actor.role === "employee" && requester !== actor.id) {
          throw new HttpError(403, "forbidden", "Só é possível consultar os próprios chamados.");
        }
        const scope = params.get("scope") === "all" ? "all" : "open";
        return json(200, { tickets: repo.listByRequester(requester, scope) });
      }
      if (method === "POST") {
        const key = req.headers.get("idempotency-key");
        if (!key) throw new HttpError(400, "idempotency_key_required", "Informe Idempotency-Key.");
        const input = await body(req, newTicketSchema);
        // O solicitante é sempre quem age; nunca um valor vindo do corpo.
        return json(201, { ticket: repo.create(actor.id, input, key, now) });
      }
    }

    if (id && !action && method === "GET") {
      return json(200, { ticket: ensureVisible(repo.get(id), actor) });
    }

    if (id && method === "POST") {
      ensureVisible(repo.get(id), actor);
      if (action === "comments") {
        const input = await body(req, z.object({ text: z.string().min(3).max(2000), reopen: z.boolean().optional() }));
        const author = actor.role === "employee" ? "Funcionário" : actor.id;
        return json(200, { ticket: repo.addComment(id, author, input.text, { reopen: input.reopen }, now) });
      }
      if (action === "transfer") {
        const input = await body(req, z.object({ group: z.string().min(2), summary: z.string().min(3).max(2000) }));
        return json(200, { ticket: repo.transfer(id, input.group, input.summary, now) });
      }
      if (action === "status") {
        if (actor.role !== "analyst") throw new HttpError(403, "forbidden", "Só analistas alteram o status.");
        const input = await body(req, z.object({ status: z.enum(STATUSES) }));
        return json(200, { ticket: repo.setStatus(id, input.status, actor.id, now) });
      }
    }

    throw new HttpError(404, "not_found", "Rota inexistente.");
  } catch (err) {
    if (err instanceof HttpError) return json(err.status, { error: { code: err.code, message: err.message } });
    console.error("[service-desk]", err);
    return json(500, { error: { code: "internal", message: "Erro interno no serviço de chamados." } });
  }
}
