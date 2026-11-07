import { beforeEach, describe, expect, it } from "vitest";
import { handleServiceDesk, type ServiceDeskOptions } from "./http";
import { ServiceDeskRepository } from "./repository";

const ANA = "ana.souza@nexo.com.br";
const CARLA = "carla.mendes@nexo.com.br";

let opts: ServiceDeskOptions;

beforeEach(() => {
  opts = {
    repo: new ServiceDeskRepository(":memory:"),
    token: "t",
    chaos: { failureRate: 0, outage: null, latencyMs: [0, 0] },
    random: () => 0.5,
  };
});

function call(method: string, path: string, init: { actor?: string; role?: string; body?: unknown; headers?: Record<string, string> } = {}) {
  const url = new URL(`http://sd/api/service-desk/${path}`);
  const req = new Request(url, {
    method,
    headers: {
      "content-type": "application/json",
      "x-service-token": "t",
      "x-actor-id": init.actor ?? ANA,
      "x-actor-role": init.role ?? "employee",
      ...init.headers,
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  return handleServiceDesk(req, url.pathname.replace("/api/service-desk/", "").split("/"), opts);
}

const newTicket = {
  type: "INC",
  title: "VPN não conecta — erro 809",
  description: "Desde ontem o notebook com Windows 11 não conecta na VPN.",
  category: "Rede e VPN",
  priority: "Alta",
  affected: "individual",
};

describe("serviço de chamados", () => {
  it("exige token de serviço", async () => {
    const res = await call("GET", "tickets", { headers: { "x-service-token": "errado" } });
    expect(res.status).toBe(401);
  });

  it("lista só os chamados abertos do próprio funcionário", async () => {
    const res = await call("GET", "tickets");
    const { tickets } = (await res.json()) as { tickets: { number: string; requesterId: string }[] };
    expect(tickets.map((t) => t.number).sort()).toEqual(["INC-20298", "INC-20311", "REQ-10442"]);
    expect(tickets.every((t) => t.requesterId === ANA)).toBe(true);
  });

  it("não expõe chamados de outro funcionário", async () => {
    expect((await call("GET", "tickets/INC-20150")).status).toBe(404);
    expect((await call("GET", `tickets?requester=${CARLA}`)).status).toBe(403);
    expect((await call("POST", "tickets/INC-20150/comments", { body: { text: "olá, tudo bem?" } })).status).toBe(404);
  });

  it("analista enxerga chamados de qualquer funcionário", async () => {
    const res = await call("GET", "tickets/INC-20150", { actor: "rafael.lima@nexo.com.br", role: "analyst" });
    expect(res.status).toBe(200);
  });

  it("cria chamado de forma idempotente e com o solicitante da sessão", async () => {
    const headers = { "idempotency-key": "draft-1" };
    const a = (await (await call("POST", "tickets", { body: { ...newTicket, requesterId: CARLA }, headers })).json()) as {
      ticket: { number: string; requesterId: string };
    };
    const b = (await (await call("POST", "tickets", { body: newTicket, headers })).json()) as { ticket: { number: string } };
    expect(a.ticket.number).toBe("INC-20520");
    expect(a.ticket.requesterId).toBe(ANA);
    expect(b.ticket.number).toBe(a.ticket.number);
  });

  it("valida o corpo do chamado", async () => {
    const res = await call("POST", "tickets", { body: { ...newTicket, category: "RH" }, headers: { "idempotency-key": "x" } });
    expect(res.status).toBe(422);
  });

  it("reabre chamado resolvido ao adicionar informação com reopen", async () => {
    const res = await call("POST", "tickets/INC-20150/comments", { actor: CARLA, body: { text: "Bloqueou de novo.", reopen: true } });
    const { ticket } = (await res.json()) as { ticket: { status: string; resolvedAt: string | null } };
    expect(ticket.status).toBe("aberto");
    expect(ticket.resolvedAt).toBeNull();
  });

  it("só analistas mudam o status", async () => {
    expect((await call("POST", "tickets/INC-20311/status", { body: { status: "resolvido" } })).status).toBe(403);
  });

  it("busca na central de ajuda", async () => {
    const res = await call("GET", "kb/search?q=vpn%20erro%20809");
    const { articles } = (await res.json()) as { articles: { id: string }[] };
    expect(articles[0]?.id).toBe("KB-001");
  });

  it("fica indisponível nas janelas de queda do sistema legado", async () => {
    opts.chaos.outage = { periodSec: 60, downSec: 5 };
    opts.now = () => new Date("2026-11-06T13:00:02Z");
    const res = await call("GET", "tickets");
    expect(res.status).toBe(503);
    expect(res.headers.get("retry-after")).toBe("2");
  });
});
