import type { DatabaseSync } from "node:sqlite";

// Usuários de exemplo. O login aceita qualquer senha para estes e-mails (PRD, tela 1).
export const SEED_USERS = [
  { id: "ana.souza@nexo.com.br", name: "Ana Souza", role: "employee", department: "Financeiro", bg: "#DCE9F7", fg: "#0062C4" },
  { id: "carla.mendes@nexo.com.br", name: "Carla Mendes", role: "employee", department: "Compras", bg: "#F6E3D3", fg: "#9A4A12" },
  { id: "bruno.tavares@nexo.com.br", name: "Bruno Tavares", role: "employee", department: "Comercial", bg: "#E6E1F7", fg: "#5B3FC4" },
  { id: "diego.ramos@nexo.com.br", name: "Diego Ramos", role: "employee", department: "Vendas", bg: "#DDF0E6", fg: "#1E7A4C" },
  { id: "elisa.prado@nexo.com.br", name: "Elisa Prado", role: "employee", department: "Marketing", bg: "#F7E1E6", fg: "#A3324F" },
  { id: "fabio.nunes@nexo.com.br", name: "Fábio Nunes", role: "employee", department: "Jurídico", bg: "#E5E8EC", fg: "#3D4656" },
  { id: "gabriela.rocha@nexo.com.br", name: "Gabriela Rocha", role: "employee", department: "Operações", bg: "#FBEFD0", fg: "#8A6100" },
  { id: "rafael.lima@nexo.com.br", name: "Rafael Lima", role: "analyst", department: "Suporte N2", bg: "#DCE9F7", fg: "#0069C7" },
  { id: "julia.costa@nexo.com.br", name: "Júlia Costa", role: "analyst", department: "Suporte N1", bg: "#DDF0E6", fg: "#1E7A4C" },
] as const;

const initials = (name: string) =>
  name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

export function seedApp(db: DatabaseSync, now = Date.now()) {
  const at = (minutesAgo: number) => new Date(now - minutesAgo * 60_000).toISOString();
  const insertUser = db.prepare(
    "INSERT INTO users (id, name, role, department, initials, avatar_bg, avatar_fg, password_changed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  );
  for (const u of SEED_USERS) insertUser.run(u.id, u.name, u.role, u.department, initials(u.name), u.bg, u.fg, at(42 * 24 * 60));
  db.prepare("INSERT INTO counters (name, value) VALUES ('draft', 380)").run();

  // Conversas de outros funcionários para o console do analista não começar vazio.
  const conv = db.prepare(
    `INSERT INTO conversations (employee_id, status, handoff_reason, handoff_summary, handoff_ticket, handoff_group,
       handoff_confidence, handoff_at, resolved_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
  );
  const msg = db.prepare(
    "INSERT INTO messages (conversation_id, role, author_id, content, steps, created_at) VALUES (?, ?, ?, ?, ?, ?)",
  );
  const steps = (...s: string[]) => JSON.stringify(s);

  const carla = conv.get(
    "carla.mendes@nexo.com.br", "waiting_human", "pedido_do_funcionario",
    "INC-20150 (senha do SAP) foi resolvido há 4 dias, mas o usuário bloqueou de novo. Precisa acessar o SAP ainda hoje para fechar pedidos. Desbloqueio automático de 30 min não resolveu.",
    "INC-20150", "Suporte N1", null, at(35), null, at(42), at(35),
  ) as { id: number };
  msg.run(carla.id, "user", "carla.mendes@nexo.com.br", "Meu usuário do SAP bloqueou de novo. Preciso de acesso ao SAP ainda hoje", "[]", at(42));
  msg.run(carla.id, "assistant", null, "Seu INC-20150 foi resolvido há 4 dias e o bloqueio voltou. Como você precisa do SAP hoje, encaminhei para o Suporte N1: um analista fala com você por aqui.", steps("consultou seus chamados", "consultou o INC-20150", "transferiu para um analista"), at(35));
  msg.run(carla.id, "system", null, "Transferida para Suporte N1", "[]", at(35));

  const bruno = conv.get(
    "bruno.tavares@nexo.com.br", "waiting_human", "baixa_confianca",
    "Impressora do 3º andar imprime folhas em branco; já existe o INC-20402 (fila travada). Não está claro se é o mesmo problema ou falta de toner. A equipe comercial precisa imprimir contratos.",
    "INC-20402", "Suporte N1", 0.41, at(14), null, at(20), at(14),
  ) as { id: number };
  msg.run(bruno.id, "user", "bruno.tavares@nexo.com.br", "A impressora do 3º andar agora sai tudo em branco e o pessoal precisa imprimir contrato", "[]", at(20));
  msg.run(bruno.id, "assistant", null, "Não tenho certeza se isso é o mesmo problema do INC-20402 ou algo novo. Vou chamar um analista para isso.", steps("consultou seus chamados", "buscou na central de ajuda", "transferiu para um analista"), at(14));
  msg.run(bruno.id, "system", null, "Transferida para Suporte N1", "[]", at(14));

  const diego = conv.get("diego.ramos@nexo.com.br", "agent", null, null, null, null, null, null, null, at(3), at(1)) as { id: number };
  msg.run(diego.id, "user", "diego.ramos@nexo.com.br", "Já liberaram o Power BI que eu pedi?", "[]", at(3));
  msg.run(diego.id, "assistant", null, "Seu REQ-10450 ainda está aberto, dentro do prazo de 5 dias úteis. Quer acrescentar alguma informação?", steps("consultou seus chamados", "consultou o REQ-10450"), at(2));

  const fabio = conv.get("fabio.nunes@nexo.com.br", "closed", null, null, null, null, null, null, "agent", at(70), at(64)) as { id: number };
  msg.run(fabio.id, "user", "fabio.nunes@nexo.com.br", "Esqueci a senha da rede", "[]", at(70));
  msg.run(fabio.id, "assistant", null, "Você mesmo consegue redefinir em senha.nexo.com.br com o código enviado ao seu celular. A nova senha vale para rede, e-mail e VPN.", steps("buscou na central de ajuda"), at(69));
  msg.run(fabio.id, "user", "fabio.nunes@nexo.com.br", "Isso resolveu, obrigado!", "[]", at(64));

  const gabi = conv.get("gabriela.rocha@nexo.com.br", "closed", null, null, null, null, null, null, "agent", at(26 * 60), at(25 * 60)) as { id: number };
  msg.run(gabi.id, "user", "gabriela.rocha@nexo.com.br", "Qual a senha do Wi-Fi para um visitante?", "[]", at(26 * 60));
  msg.run(gabi.id, "assistant", null, "Visitantes usam a rede Nexo-Guest. A senha do dia fica com a recepção.", steps("buscou na central de ajuda"), at(25 * 60));
}
