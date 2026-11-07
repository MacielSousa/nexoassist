import type { EntityManager } from "typeorm";
import { classifyPriority, SEVERITIES, slaDeadline, type Affected, type Category } from "@modules/tickets/domain/ticketRules";

/**
 * Histórico de demonstração (60 dias) para os relatórios terem o que mostrar:
 * chamados abertos e resolvidos por analistas (alguns fora do prazo) e conversas
 * resolvidas pelo agent ou transferidas e assumidas. Determinístico (mesma semente).
 */

const TEMPLATES: { title: string; category: Category; type: "INC" | "REQ" }[] = [
  { title: "VPN não conecta", category: "Rede e VPN", type: "INC" },
  { title: "Wi-Fi caindo na sala de reunião", category: "Rede e VPN", type: "INC" },
  { title: "Senha da rede expirada", category: "Acesso", type: "INC" },
  { title: "Acesso a pasta do SharePoint", category: "Acesso", type: "REQ" },
  { title: "Notebook não liga", category: "Hardware", type: "INC" },
  { title: "Monitor adicional", category: "Hardware", type: "REQ" },
  { title: "Impressora não imprime", category: "Hardware", type: "INC" },
  { title: "Instalação do Power BI", category: "Software", type: "REQ" },
  { title: "Excel fechando sozinho", category: "Software", type: "INC" },
  { title: "Outlook sem sincronizar", category: "E-mail", type: "INC" },
  { title: "Caixa de e-mail cheia", category: "E-mail", type: "REQ" },
  { title: "Dúvida sobre o crachá de acesso", category: "Outros", type: "REQ" },
];
const REASONS = ["pedido_do_funcionario", "pedido_do_funcionario", "prazo_vencido", "baixa_confianca", "critico"];
const AFFECTED: Affected[] = ["individual", "individual", "individual", "equipe", "empresa"];

/** Gerador pseudoaleatório com semente (mulberry32): o histórico é sempre o mesmo. */
function random(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export async function seedHistory(tx: EntityManager, days = 60) {
  const rnd = random(42);
  const pick = <T>(list: T[]) => list[Math.floor(rnd() * list.length)]!;
  const between = (min: number, max: number) => min + rnd() * (max - min);

  const users = (await tx.query(`SELECT id, name, role, team FROM users WHERE active`)) as { id: string; name: string; role: string; team: string | null }[];
  const employees = users.filter((u) => u.role === "employee");
  const analysts = users.filter((u) => u.role === "analyst");
  if (!employees.length || !analysts.length) return;

  const HOUR = 3_600_000;
  const now = Date.now();
  let tickets = 0;
  let conversations = 0;

  for (let d = days; d >= 1; d--) {
    const dayStart = now - d * 24 * HOUR;
    const weekend = [0, 6].includes(new Date(dayStart).getDay());

    // ---- Chamados ----
    for (let i = 0, n = weekend ? Math.floor(between(0, 2)) : Math.floor(between(2, 6)); i < n; i++) {
      const template = pick(TEMPLATES);
      const affected = pick(AFFECTED);
      const severity = template.type === "REQ" ? "sem_urgencia" : pick([...SEVERITIES]);
      const { priority, reason } = classifyPriority({ affected, severity, sameDayCommitment: rnd() < 0.15 });
      const created = new Date(dayStart + between(8, 18) * HOUR);
      const analyst = pick(analysts);

      // Quanto mais antigo, mais provável já estar resolvido. ~20% estouram o prazo.
      const resolvedChance = d > 7 ? 0.9 : d > 2 ? 0.55 : 0.2;
      const resolved = rnd() < resolvedChance;
      const deadline = slaDeadline(priority, created).getTime();
      const resolvedAt = resolved ? new Date(rnd() < 0.8 ? between(created.getTime() + HOUR / 2, deadline) : between(deadline, deadline + 48 * HOUR)) : null;
      const finished = resolvedAt && resolvedAt.getTime() < now;
      const status = finished ? (rnd() < 0.6 ? "fechado" : "resolvido") : pick(["aberto", "em_andamento", "aguardando_analista"]);
      const requester = pick(employees);
      const seq = template.type === "INC" ? "ticket_inc_seq" : "ticket_req_seq";
      const [seqRow] = (await tx.query(`SELECT nextval('${seq}') AS value`)) as { value: string }[];
      const value = seqRow!.value;

      await tx.query(
        `INSERT INTO tickets (number, type, title, description, category, priority, priority_reason, status, affected, requester_id,
           assigned_group, assigned_analyst_id, resolved_at, resolved_by_id, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
        [
          `${template.type}-${value}`, template.type, template.title, `${template.title} (registro de exemplo).`, template.category, priority, reason, status,
          affected, requester.id, analyst.team, status === "em_andamento" || finished ? analyst.id : null,
          finished ? resolvedAt : null, finished ? analyst.id : null, created, finished ? resolvedAt : created,
        ],
      );
      tickets++;
    }

    // ---- Conversas ----
    for (let i = 0, n = weekend ? 1 : Math.floor(between(3, 7)); i < n; i++) {
      const employee = pick(employees);
      const created = new Date(dayStart + between(8, 18) * HOUR);
      const transferred = rnd() < 0.35;
      const analyst = pick(analysts);
      const handoffAt = transferred ? new Date(created.getTime() + between(2, 10) * 60_000) : null;
      const takenAt = handoffAt ? new Date(handoffAt.getTime() + between(3, 120) * 60_000) : null;
      const closedAt = new Date((takenAt ?? created).getTime() + between(5, 40) * 60_000);

      const [conversationRow] = (await tx.query(
        `INSERT INTO conversations (employee_id, status, handoff_reason, handoff_summary, handoff_group, handoff_at, handled_by_id, taken_at,
           closed_at, closed_by_id, resolved_by, created_at, updated_at)
         VALUES ($1, 'closed', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $8) RETURNING id`,
        [
          employee.id, transferred ? pick(REASONS) : null, transferred ? "Atendimento de exemplo transferido." : null, transferred ? analyst.team : null, handoffAt,
          transferred ? analyst.id : null, takenAt, closedAt, transferred ? analyst.id : null, transferred ? "analyst" : "agent", created,
        ],
      )) as { id: string }[];
      await tx.query(`INSERT INTO messages (conversation_id, role, author_id, author_name, content, created_at) VALUES ($1, 'user', $2, $3, $4, $5)`, [
        conversationRow!.id, employee.id, employee.name, pick(TEMPLATES).title, created,
      ]);
      conversations++;
    }
  }
  console.log(`Histórico: ${tickets} chamados e ${conversations} conversas em ${days} dias.`);
}
