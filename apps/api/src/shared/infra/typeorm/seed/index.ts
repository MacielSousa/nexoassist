import "reflect-metadata";
import { hash } from "bcryptjs";
import { AppDataSource } from "../data-source";
import { SEED_ARTICLES, SEED_TICKETS, SEED_USERS } from "./data";
import { seedHistory } from "./history";

/**
 * Popula o banco com dados de exemplo. Idempotente: se já houver usuários, não faz nada.
 * Uso: npm run seed (todos os usuários recebem a senha SEED_PASSWORD, padrão "nexo1234").
 */
async function seed() {
  await AppDataSource.initialize();
  const db = AppDataSource.manager;

  const [existing] = (await db.query(`SELECT COUNT(*)::int AS count FROM users`)) as { count: number }[];
  if (existing!.count > 0) {
    console.log("Banco já populado; seed ignorado.");
    return;
  }

  const password = await hash(process.env.SEED_PASSWORD || "nexo1234", 10);
  const ago = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  await db.transaction(async (tx) => {
    const ids = new Map<string, string>();
    for (const u of SEED_USERS) {
      const [row] = (await tx.query(
        `INSERT INTO users (name, email, password, role, department, team, password_changed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [u.name, u.email, password, u.role, u.department, u.team ?? null, ago(42)],
      )) as { id: string }[];
      ids.set(u.email, row!.id);
    }
    const idByName = new Map(SEED_USERS.map((u) => [u.name, ids.get(u.email)!]));

    for (const t of SEED_TICKETS) {
      const [row] = (await tx.query(
        `INSERT INTO tickets (number, type, title, description, category, priority, priority_reason, status, affected,
           requester_id, assigned_group, resolved_at, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING id`,
        [t.number, t.type, t.title, t.description, t.category, t.priority, t.priorityReason, t.status, t.affected,
         ids.get(t.requester), t.group, t.resolvedDaysAgo ? ago(t.resolvedDaysAgo) : null, ago(t.createdDaysAgo), ago(t.updatedDaysAgo)],
      )) as { id: string }[];
      for (const c of t.comments ?? []) {
        await tx.query(`INSERT INTO ticket_comments (ticket_id, author_id, author_name, body, created_at) VALUES ($1, $2, $3, $4, $5)`, [
          row!.id, idByName.get(c.author) ?? null, c.author, c.body, ago(c.daysAgo),
        ]);
      }
    }

    for (const a of SEED_ARTICLES) {
      await tx.query(`INSERT INTO articles (code, title, body, category, tags) VALUES ($1, $2, $3, $4, $5)`, [a.code, a.title, a.body, a.category, a.tags]);
    }

    // Conversas de outros funcionários para o console do analista não começar vazio.
    const minutes = (m: number) => new Date(Date.now() - m * 60_000);
    const conversation = async (email: string, fields: Record<string, unknown>, createdMin: number, updatedMin: number) => {
      const cols = Object.keys(fields);
      const [row] = (await tx.query(
        `INSERT INTO conversations (employee_id, ${cols.join(", ")}, created_at, updated_at)
         VALUES ($1, ${cols.map((_, i) => `$${i + 2}`).join(", ")}, $${cols.length + 2}, $${cols.length + 3}) RETURNING id`,
        [ids.get(email), ...Object.values(fields), minutes(createdMin), minutes(updatedMin)],
      )) as { id: string }[];
      return row!.id;
    };
    const message = (conversationId: string, role: string, content: string, min: number, steps: string[] = [], author?: string) =>
      tx.query(`INSERT INTO messages (conversation_id, role, author_id, author_name, content, steps, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)`, [
        conversationId, role, author ? ids.get(author) : null, author ? SEED_USERS.find((u) => u.email === author)?.name : null, content, JSON.stringify(steps), minutes(min),
      ]);

    const carla = await conversation("carla.mendes@nexo.com.br", {
      status: "waiting_human", handoff_reason: "pedido_do_funcionario", handoff_ticket: "INC-20150", handoff_group: "Suporte N1", handoff_at: minutes(35),
      handoff_summary: "INC-20150 (senha do SAP) foi resolvido há 4 dias, mas o usuário bloqueou de novo. Precisa acessar o SAP ainda hoje para fechar pedidos. O desbloqueio automático de 30 min não resolveu.",
    }, 42, 35);
    await message(carla, "user", "Meu usuário do SAP bloqueou de novo. Preciso de acesso ao SAP ainda hoje", 42, [], "carla.mendes@nexo.com.br");
    await message(carla, "assistant", "Seu INC-20150 foi resolvido há 4 dias e o bloqueio voltou. Como você precisa do SAP hoje, encaminhei para o Suporte N1: um analista fala com você por aqui.", 35, ["consultou seus chamados", "consultou o INC-20150", "transferiu para um analista"]);
    await message(carla, "system", "Transferida para Suporte N1", 35);

    const bruno = await conversation("bruno.tavares@nexo.com.br", {
      status: "waiting_human", handoff_reason: "baixa_confianca", handoff_ticket: "INC-20402", handoff_group: "Suporte N1", handoff_confidence: 0.41, handoff_at: minutes(14),
      handoff_summary: "Impressora do 3º andar imprime folhas em branco; já existe o INC-20402 (fila travada). Não está claro se é o mesmo problema ou falta de toner. A equipe comercial precisa imprimir contratos.",
    }, 20, 14);
    await message(bruno, "user", "A impressora do 3º andar agora sai tudo em branco e o pessoal precisa imprimir contrato", 20, [], "bruno.tavares@nexo.com.br");
    await message(bruno, "assistant", "Não tenho certeza se isso é o mesmo problema do INC-20402 ou algo novo. Vou chamar um analista para isso.", 14, ["consultou seus chamados", "buscou na central de ajuda", "transferiu para um analista"]);
    await message(bruno, "system", "Transferida para Suporte N1", 14);

    const diego = await conversation("diego.ramos@nexo.com.br", { status: "agent" }, 3, 2);
    await message(diego, "user", "Já liberaram o Power BI que eu pedi?", 3, [], "diego.ramos@nexo.com.br");
    await message(diego, "assistant", "Seu REQ-10450 ainda está aberto, dentro do prazo de 5 dias úteis. Quer acrescentar alguma informação?", 2, ["consultou seus chamados", "consultou o REQ-10450"]);

    const fabio = await conversation("fabio.nunes@nexo.com.br", { status: "closed", resolved_by: "agent" }, 70, 64);
    await message(fabio, "user", "Esqueci a senha da rede", 70, [], "fabio.nunes@nexo.com.br");
    await message(fabio, "assistant", "Você mesmo consegue redefinir em senha.nexo.com.br com o código enviado ao seu celular. A nova senha vale para rede, e-mail e VPN.", 69, ["buscou na central de ajuda"]);
    await message(fabio, "user", "Isso resolveu, obrigado!", 64, [], "fabio.nunes@nexo.com.br");

    // 60 dias de histórico para os relatórios.
    await seedHistory(tx);
  });

  console.log(`Seed concluído: ${SEED_USERS.length} usuários, ${SEED_TICKETS.length} chamados, ${SEED_ARTICLES.length} artigos.`);
}

seed()
  .catch((err) => {
    console.error("Falha no seed:", err);
    process.exitCode = 1;
  })
  .finally(() => AppDataSource.destroy());
