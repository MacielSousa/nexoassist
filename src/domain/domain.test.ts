import { describe, expect, it } from "vitest";
import {
  addBusinessDays,
  addBusinessHours,
  businessHoursBetween,
  canReopen,
  classifyPriority,
  findDuplicates,
  isBusinessTime,
  slaDeadline,
  slaStatus,
  type Ticket,
} from "./index";

// Datas em UTC; Brasília = UTC-3. 06/11/2026 é uma sexta-feira.
const brt = (isoLocal: string) => new Date(`${isoLocal}-03:00`);

describe("horário útil", () => {
  it("reconhece expediente de segunda a sexta, 8h às 18h", () => {
    expect(isBusinessTime(brt("2026-11-06T09:00:00"))).toBe(true);
    expect(isBusinessTime(brt("2026-11-06T18:00:00"))).toBe(false);
    expect(isBusinessTime(brt("2026-11-07T10:00:00"))).toBe(false); // sábado
  });

  it("4 h úteis a partir de sexta 17h terminam segunda 11h", () => {
    expect(addBusinessHours(brt("2026-11-06T17:00:00"), 4)).toEqual(brt("2026-11-09T11:00:00"));
  });

  it("começa a contar no próximo expediente quando aberto fora do horário", () => {
    expect(addBusinessHours(brt("2026-11-07T15:00:00"), 2)).toEqual(brt("2026-11-09T10:00:00"));
    expect(addBusinessHours(brt("2026-11-09T06:30:00"), 1)).toEqual(brt("2026-11-09T09:00:00"));
  });

  it("3 dias úteis a partir de terça 10h vencem sexta 10h", () => {
    expect(addBusinessDays(brt("2026-11-03T10:00:00"), 3)).toEqual(brt("2026-11-06T10:00:00"));
  });

  it("conta horas úteis entre dois instantes", () => {
    expect(businessHoursBetween(brt("2026-11-06T16:00:00"), brt("2026-11-09T09:00:00"))).toBe(3);
  });
});

describe("prioridade (Anexo A)", () => {
  it("algo parado para uma equipe ou para a empresa é Crítica", () => {
    expect(classifyPriority({ affected: "equipe", severity: "parado", sameDayCommitment: false }).priority).toBe("Crítica");
    expect(classifyPriority({ affected: "empresa", severity: "impede_trabalho", sameDayCommitment: false }).priority).toBe(
      "Crítica",
    );
  });

  it("impede uma pessoa de trabalhar é Alta", () => {
    expect(classifyPriority({ affected: "individual", severity: "impede_trabalho", sameDayCommitment: false }).priority).toBe(
      "Alta",
    );
  });

  it("compromisso no mesmo dia eleva para Alta", () => {
    const d = classifyPriority({ affected: "individual", severity: "atrapalha", sameDayCommitment: true });
    expect(d.priority).toBe("Alta");
    expect(d.reason).toMatch(/compromisso/);
  });

  it("atrapalha com alternativa é Média; pedido sem urgência é Baixa", () => {
    expect(classifyPriority({ affected: "individual", severity: "atrapalha", sameDayCommitment: false }).priority).toBe("Média");
    expect(classifyPriority({ affected: "individual", severity: "sem_urgencia", sameDayCommitment: false }).priority).toBe(
      "Baixa",
    );
  });
});

const ticket = (over: Partial<Ticket>): Ticket => ({
  number: "INC-1",
  type: "INC",
  title: "t",
  description: "d",
  category: "Hardware",
  priority: "Média",
  status: "aberto",
  requesterId: "u1",
  affected: "individual",
  createdAt: brt("2026-10-16T14:20:00").toISOString(),
  updatedAt: brt("2026-10-16T14:20:00").toISOString(),
  resolvedAt: null,
  assignedGroup: null,
  comments: [],
  ...over,
});

describe("SLA", () => {
  it("crítica vence em 1 hora corrida (plantão 24 h)", () => {
    expect(slaDeadline("Crítica", brt("2026-11-07T23:30:00"))).toEqual(brt("2026-11-08T00:30:00"));
  });

  it("chamado de prioridade média parado há 6 dias está vencido", () => {
    const s = slaStatus(ticket({ status: "aguardando_analista" }), brt("2026-10-22T10:00:00"));
    expect(s.overdue).toBe(true);
    expect(s.label).toBe("3 dias úteis");
  });

  it("não vence enquanto aguarda o funcionário nem depois de resolvido", () => {
    const now = brt("2026-10-30T10:00:00");
    expect(slaStatus(ticket({ status: "aguardando_funcionario" }), now).overdue).toBe(false);
    expect(slaStatus(ticket({ status: "resolvido" }), now).overdue).toBe(false);
  });

  it("resolvido há até 7 dias pode ser reaberto", () => {
    const resolved = ticket({ status: "resolvido", resolvedAt: brt("2026-11-02T10:00:00").toISOString() });
    expect(canReopen(resolved, brt("2026-11-06T10:00:00"))).toBe(true);
    expect(canReopen(resolved, brt("2026-11-12T10:00:00"))).toBe(false);
  });
});

describe("duplicidade", () => {
  const now = brt("2026-11-06T10:00:00");
  const vpn = ticket({
    number: "INC-20400",
    category: "Rede e VPN",
    title: "VPN cai toda hora com erro 809",
    description: "A VPN desconecta e mostra erro 809 no notebook.",
  });
  const notebook = ticket({
    number: "INC-20311",
    title: "Notebook lento após atualização do Windows",
    description: "Lentidão geral desde a atualização de 15/10.",
  });

  it("encontra o chamado aberto sobre o mesmo problema", () => {
    const found = findDuplicates(
      { category: "Rede e VPN", title: "VPN não conecta — erro 809", description: "Desde ontem a VPN não conecta, erro 809." },
      [vpn, notebook],
      now,
    );
    expect(found.map((f) => f.number)).toEqual(["INC-20400"]);
    expect(found[0]?.action).toBe("atualizar");
  });

  it("sugere reabrir um chamado resolvido recentemente", () => {
    const resolved = { ...vpn, status: "resolvido" as const, resolvedAt: brt("2026-11-04T10:00:00").toISOString() };
    const found = findDuplicates(
      { category: "Rede e VPN", title: "Erro 809 na VPN voltou", description: "O erro 809 da VPN voltou a aparecer." },
      [resolved],
      now,
    );
    expect(found[0]?.action).toBe("reabrir");
  });

  it("ignora chamados de outros assuntos e encerrados há muito tempo", () => {
    const old = { ...vpn, status: "fechado" as const, resolvedAt: brt("2026-09-01T10:00:00").toISOString() };
    expect(
      findDuplicates({ category: "Software", title: "Excel trava ao abrir planilha", description: "O Excel fecha sozinho." }, [
        notebook,
        old,
      ], now),
    ).toEqual([]);
  });
});
