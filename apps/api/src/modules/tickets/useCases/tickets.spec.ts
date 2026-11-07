import { beforeEach, describe, expect, it } from "vitest";
import type { IActor } from "@modules/accounts/dtos/IActor";
import { UsersRepositoryInMemory } from "@modules/accounts/repositories/in-memory/UsersRepositoryInMemory";
import { LegacyServiceDeskProvider } from "@modules/tickets/providers/ServiceDeskProvider/implementations/LegacyServiceDeskProvider";
import { ServiceDeskUnavailableError } from "@modules/tickets/providers/ServiceDeskProvider/IServiceDeskProvider";
import { ArticlesRepositoryInMemory } from "@modules/tickets/repositories/in-memory/ArticlesRepositoryInMemory";
import { TicketsRepositoryInMemory } from "@modules/tickets/repositories/in-memory/TicketsRepositoryInMemory";
import { AddTicketCommentUseCase } from "./addTicketComment/AddTicketCommentUseCase";
import { CreateTicketUseCase } from "./createTicket/CreateTicketUseCase";
import { ListTicketsUseCase } from "./listTickets/ListTicketsUseCase";
import { SearchArticlesUseCase } from "./searchArticles/SearchArticlesUseCase";
import { ShowTicketUseCase } from "./showTicket/ShowTicketUseCase";
import { UpdateTicketStatusUseCase } from "./updateTicketStatus/UpdateTicketStatusUseCase";

let tickets: TicketsRepositoryInMemory;
let users: UsersRepositoryInMemory;
let ana: IActor;
let carla: IActor;
let rafael: IActor;

const vpn = {
  type: "INC" as const,
  title: "VPN não conecta — erro 809",
  description: "Desde ontem o notebook com Windows 11 não conecta na VPN.",
  category: "Rede e VPN" as const,
  affected: "individual" as const,
  severity: "atrapalha" as const,
  sameDayCommitment: true,
};

beforeEach(async () => {
  tickets = new TicketsRepositoryInMemory();
  users = new UsersRepositoryInMemory();
  const mk = async (name: string, role: IActor["role"]) => {
    const u = await users.create({ name, email: `${name.toLowerCase()}@nexo.com.br`, password: "x", role, department: "TI", team: role === "analyst" ? "Suporte N2" : null });
    return { id: u.id, role };
  };
  ana = await mk("Ana", "employee");
  carla = await mk("Carla", "employee");
  rafael = await mk("Rafael", "analyst");
});

describe("Chamados", () => {
  it("calcula a prioridade pelas regras e numera pela sequência", async () => {
    const ticket = await new CreateTicketUseCase(tickets).execute({ actor: ana, data: vpn });
    expect(ticket).toMatchObject({ number: "INC-20520", priority: "Alta", priorityReason: "Há um compromisso no mesmo dia.", status: "aberto" });
  });

  it("é idempotente: a mesma chave não cria dois chamados", async () => {
    const create = new CreateTicketUseCase(tickets);
    const a = await create.execute({ actor: ana, data: vpn, idempotencyKey: "D-381" });
    const b = await create.execute({ actor: ana, data: vpn, idempotencyKey: "D-381" });
    expect(b.number).toBe(a.number);
    expect(tickets.tickets).toHaveLength(1);
  });

  it("funcionário não vê nem comenta chamado de outra pessoa", async () => {
    const t = await new CreateTicketUseCase(tickets).execute({ actor: ana, data: vpn });
    await expect(new ShowTicketUseCase(tickets).execute({ actor: carla, number: t.number })).rejects.toMatchObject({ statusCode: 404 });
    await expect(new AddTicketCommentUseCase(tickets, users).execute({ actor: carla, number: t.number, body: "oi" })).rejects.toMatchObject({ statusCode: 404 });
    await expect(new ListTicketsUseCase(tickets).execute({ actor: carla, requesterId: ana.id, scope: "all" })).rejects.toMatchObject({ statusCode: 403 });
    expect(await new ListTicketsUseCase(tickets).execute({ actor: carla, scope: "all" })).toEqual([]);
  });

  it("analista enxerga e muda o status; resolvido pode ser reaberto pelo funcionário", async () => {
    const t = await new CreateTicketUseCase(tickets).execute({ actor: ana, data: vpn });
    const resolved = await new UpdateTicketStatusUseCase(tickets, users).execute({ actor: rafael, number: t.number, status: "resolvido" });
    expect(resolved.canReopen).toBe(true);

    const reopened = await new AddTicketCommentUseCase(tickets, users).execute({ actor: ana, number: t.number, body: "Voltou a acontecer.", reopen: true });
    expect(reopened.status).toBe("aberto");
    const detail = await new ShowTicketUseCase(tickets).execute({ actor: ana, number: t.number });
    expect(detail.comments?.map((c) => c.authorName)).toEqual(["Rafael", "Ana"]);
  });

  it("funcionário não muda status", async () => {
    const t = await new CreateTicketUseCase(tickets).execute({ actor: ana, data: vpn });
    await expect(new UpdateTicketStatusUseCase(tickets, users).execute({ actor: ana, number: t.number, status: "fechado" })).rejects.toMatchObject({ statusCode: 403 });
  });
});

describe("Central de ajuda", () => {
  it("prioriza tags e título", async () => {
    const articles = new ArticlesRepositoryInMemory();
    await articles.create({ code: "KB-001", title: "VPN com erro 809", body: "Reinstale o cliente de VPN.", category: "Rede e VPN", tags: ["vpn", "809"] });
    await articles.create({ code: "KB-002", title: "Horário do service desk", body: "Segunda a sexta.", category: "Outros", tags: ["horario"] });
    const found = await new SearchArticlesUseCase(articles).execute("minha vpn deu erro 809");
    expect(found.map((a) => a.code)).toEqual(["KB-001"]);
  });
});

describe("Sistema legado (provider usado pelo agent)", () => {
  const provider = (failures: number) => {
    let calls = 0;
    // Sem latência, cada tentativa sorteia uma vez: as primeiras `failures` tentativas falham.
    const random = () => (calls++ < failures ? 0 : 0.99);
    return new LegacyServiceDeskProvider(tickets, new ArticlesRepositoryInMemory(), users, { failureRate: 0.5, outage: null, latencyMs: [0, 0] }, { retries: 3, backoffMs: 1 }, random);
  };

  it("tenta de novo quando o legado cai por alguns instantes", async () => {
    await new CreateTicketUseCase(tickets).execute({ actor: ana, data: vpn });
    expect(await provider(2).listTickets(ana, "open")).toHaveLength(1);
  });

  it("desiste depois das tentativas com erro 503 tratável", async () => {
    await expect(provider(10).listTickets(ana, "open")).rejects.toBeInstanceOf(ServiceDeskUnavailableError);
  });

  it("chamado alheio vira null (sem vazar existência)", async () => {
    const t = await new CreateTicketUseCase(tickets).execute({ actor: ana, data: vpn });
    expect(await provider(0).getTicket(carla, t.number)).toBeNull();
  });
});
