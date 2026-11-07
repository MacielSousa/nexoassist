/**
 * Catálogo de permissões. Cada chave corresponde a uma checagem real na API, por isso o
 * catálogo vive no código (e é espelhado na tabela `permissions` pela migration).
 * Roles são cadastráveis: um admin combina estas permissões como quiser.
 */
export const PERMISSIONS = [
  { key: "chat.use", group: "Atendimento", description: "Usar o chat com o Nexo Assist" },
  { key: "tickets.view_own", group: "Chamados", description: "Ver os próprios chamados" },
  { key: "tickets.create", group: "Chamados", description: "Abrir chamados" },
  { key: "tickets.view_all", group: "Chamados", description: "Ver chamados de todos os funcionários" },
  { key: "tickets.manage", group: "Chamados", description: "Alterar o status de chamados" },
  { key: "console.view", group: "Console", description: "Ver as conversas no console" },
  { key: "console.attend", group: "Console", description: "Assumir, responder, devolver e encerrar conversas" },
  { key: "reports.view", group: "Relatórios", description: "Ver relatórios e exportar CSV" },
  { key: "users.view", group: "Administração", description: "Ver a lista de usuários" },
  { key: "users.manage", group: "Administração", description: "Cadastrar e editar usuários e conceder permissões" },
  { key: "roles.manage", group: "Administração", description: "Criar e editar roles e suas permissões" },
] as const;

export type Permission = (typeof PERMISSIONS)[number]["key"];
export const PERMISSION_KEYS = PERMISSIONS.map((p) => p.key) as [Permission, ...Permission[]];

/** Roles criadas na instalação (a partir dos perfis antigos admin/analista/funcionário). */
export const SYSTEM_ROLES: { key: string; name: string; description: string; permissions: Permission[] }[] = [
  {
    key: "admin",
    name: "Admin",
    description: "Gerencia usuários, roles e acessos; vê relatórios e o console.",
    permissions: [...PERMISSION_KEYS],
  },
  {
    key: "analyst",
    name: "Analista",
    description: "Atende conversas transferidas e trata chamados.",
    permissions: ["tickets.view_all", "tickets.manage", "console.view", "console.attend", "reports.view"],
  },
  {
    key: "employee",
    name: "Funcionário",
    description: "Usa o chat para tirar dúvidas e abrir chamados.",
    permissions: ["chat.use", "tickets.view_own", "tickets.create"],
  },
];
