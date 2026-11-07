import type { Article, NewTicket, Ticket, TicketStatus } from "@/domain";

// Cliente HTTP do serviço de chamados. O sistema é legado e cai por alguns segundos de vez em quando,
// então toda chamada tem timeout e é repetida com backoff antes de desistir.

export class ServiceDeskUnavailableError extends Error {
  constructor() {
    super("O sistema de chamados está indisponível no momento.");
    this.name = "ServiceDeskUnavailableError";
  }
}

export class ServiceDeskError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ServiceDeskError";
  }
}

export interface ServiceDeskClientOptions {
  baseUrl: string;
  token: string;
  actor: { id: string; role: "employee" | "analyst" };
  fetch?: typeof fetch;
  retries?: number;
  timeoutMs?: number;
  backoffMs?: number;
}

export class ServiceDeskClient {
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly opts: ServiceDeskClientOptions) {
    this.fetchImpl = opts.fetch ?? fetch;
  }

  private async request<T>(method: string, path: string, body?: unknown, headers: Record<string, string> = {}): Promise<T> {
    const retries = this.opts.retries ?? 3;
    const backoff = this.opts.backoffMs ?? 400;
    for (let attempt = 0; ; attempt++) {
      let res: Response | null = null;
      try {
        res = await this.fetchImpl(`${this.opts.baseUrl}/${path}`, {
          method,
          headers: {
            "content-type": "application/json",
            "x-service-token": this.opts.token,
            "x-actor-id": this.opts.actor.id,
            "x-actor-role": this.opts.actor.role,
            ...headers,
          },
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: AbortSignal.timeout(this.opts.timeoutMs ?? 4000),
          cache: "no-store",
        });
      } catch {
        res = null; // rede ou timeout: tratado como indisponibilidade
      }

      if (res && res.status !== 503 && res.status < 500) {
        const data = (await res.json().catch(() => ({}))) as { error?: { code: string; message: string } };
        if (!res.ok) throw new ServiceDeskError(res.status, data.error?.code ?? "error", data.error?.message ?? "Erro");
        return data as T;
      }
      if (attempt >= retries) throw new ServiceDeskUnavailableError();
      // Backoff exponencial: 400 ms, 800 ms, 1,6 s (cobre as quedas curtas do legado).
      await new Promise((r) => setTimeout(r, backoff * 2 ** attempt));
    }
  }

  async listTickets(scope: "open" | "all" = "open", requester?: string): Promise<Ticket[]> {
    const q = new URLSearchParams({ scope });
    if (requester) q.set("requester", requester);
    return (await this.request<{ tickets: Ticket[] }>("GET", `tickets?${q}`)).tickets;
  }

  async getTicket(number: string): Promise<Ticket | null> {
    try {
      return (await this.request<{ ticket: Ticket }>("GET", `tickets/${encodeURIComponent(number)}`)).ticket;
    } catch (err) {
      if (err instanceof ServiceDeskError && err.status === 404) return null;
      throw err;
    }
  }

  async createTicket(input: NewTicket, idempotencyKey: string): Promise<Ticket> {
    return (await this.request<{ ticket: Ticket }>("POST", "tickets", input, { "idempotency-key": idempotencyKey })).ticket;
  }

  async addComment(number: string, text: string, reopen = false): Promise<Ticket> {
    return (await this.request<{ ticket: Ticket }>("POST", `tickets/${encodeURIComponent(number)}/comments`, { text, reopen }))
      .ticket;
  }

  async transfer(number: string, group: string, summary: string): Promise<Ticket> {
    return (await this.request<{ ticket: Ticket }>("POST", `tickets/${encodeURIComponent(number)}/transfer`, { group, summary }))
      .ticket;
  }

  async setStatus(number: string, status: TicketStatus): Promise<Ticket> {
    return (await this.request<{ ticket: Ticket }>("POST", `tickets/${encodeURIComponent(number)}/status`, { status })).ticket;
  }

  async searchArticles(query: string): Promise<(Article & { score: number })[]> {
    return (await this.request<{ articles: (Article & { score: number })[] }>("GET", `kb/search?q=${encodeURIComponent(query)}`))
      .articles;
  }
}
