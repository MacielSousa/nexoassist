import type { SupportTeam, UserRole } from "@modules/accounts/dtos/UserRole";
import type { Affected, Category, Priority, TicketStatus, TicketType } from "@modules/tickets/domain/ticketRules";

// Dados de exemplo (Anexo B do PRD). Datas relativas ao momento do seed para que
// os cenários ("parado há 6 dias", "resolvido há 4 dias") continuem fazendo sentido.

export const SEED_USERS: { name: string; email: string; role: UserRole; department: string; team?: SupportTeam }[] = [
  { name: "Admin Nexo", email: "admin@nexo.com.br", role: "admin", department: "TI" },
  { name: "Rafael Lima", email: "rafael.lima@nexo.com.br", role: "analyst", department: "TI", team: "Suporte N2" },
  { name: "Júlia Costa", email: "julia.costa@nexo.com.br", role: "analyst", department: "TI", team: "Suporte N1" },
  { name: "Ana Souza", email: "ana.souza@nexo.com.br", role: "employee", department: "Financeiro" },
  { name: "Carla Mendes", email: "carla.mendes@nexo.com.br", role: "employee", department: "Compras" },
  { name: "Bruno Tavares", email: "bruno.tavares@nexo.com.br", role: "employee", department: "Comercial" },
  { name: "Diego Ramos", email: "diego.ramos@nexo.com.br", role: "employee", department: "Vendas" },
  { name: "Elisa Prado", email: "elisa.prado@nexo.com.br", role: "employee", department: "Marketing" },
  { name: "Fábio Nunes", email: "fabio.nunes@nexo.com.br", role: "employee", department: "Jurídico" },
  { name: "Gabriela Rocha", email: "gabriela.rocha@nexo.com.br", role: "employee", department: "Operações" },
];

interface SeedTicket {
  number: string;
  type: TicketType;
  title: string;
  description: string;
  category: Category;
  priority: Priority;
  priorityReason: string;
  status: TicketStatus;
  requester: string;
  affected: Affected;
  group: string | null;
  createdDaysAgo: number;
  updatedDaysAgo: number;
  resolvedDaysAgo?: number;
  comments?: { author: string; body: string; daysAgo: number }[];
}

export const SEED_TICKETS: SeedTicket[] = [
  {
    number: "INC-20311", type: "INC", title: "Notebook lento após atualização do Windows",
    description: "Lentidão geral desde a atualização. Reiniciar e rodar o diagnóstico da central não resolveu.",
    category: "Hardware", priority: "Média", priorityReason: "Atrapalha, mas há alternativa.", status: "aguardando_analista",
    requester: "ana.souza@nexo.com.br", affected: "individual", group: "Suporte N1", createdDaysAgo: 6.1, updatedDaysAgo: 6,
  },
  {
    number: "INC-20298", type: "INC", title: "Acesso à pasta Financeiro no SharePoint",
    description: "Sem permissão para abrir a pasta Financeiro/Fechamento no SharePoint.",
    category: "Acesso", priority: "Média", priorityReason: "Atrapalha, mas há alternativa.", status: "em_andamento",
    requester: "ana.souza@nexo.com.br", affected: "individual", group: "Suporte N1", createdDaysAgo: 8, updatedDaysAgo: 1,
    comments: [{ author: "Júlia Costa", body: "Pedido enviado ao gestor da pasta para aprovação.", daysAgo: 1 }],
  },
  {
    number: "REQ-10442", type: "REQ", title: "Segundo monitor para home office",
    description: "Solicito um segundo monitor para o home office, aprovado pela gestora.",
    category: "Hardware", priority: "Baixa", priorityReason: "Pedido ou melhoria sem urgência.", status: "aprovado",
    requester: "ana.souza@nexo.com.br", affected: "individual", group: "Logística de TI", createdDaysAgo: 12, updatedDaysAgo: 2,
  },
  {
    number: "INC-19877", type: "INC", title: "Outlook não sincroniza no celular",
    description: "E-mails não chegam no app do Outlook no celular.",
    category: "E-mail", priority: "Média", priorityReason: "Atrapalha, mas há alternativa.", status: "fechado",
    requester: "ana.souza@nexo.com.br", affected: "individual", group: "Suporte N1", createdDaysAgo: 70, updatedDaysAgo: 65, resolvedDaysAgo: 65,
  },
  {
    number: "INC-20150", type: "INC", title: "Senha do SAP bloqueada",
    description: "Usuário do SAP bloqueado após tentativas de login.",
    category: "Acesso", priority: "Média", priorityReason: "Atrapalha, mas há alternativa.", status: "resolvido",
    requester: "carla.mendes@nexo.com.br", affected: "individual", group: "Suporte N1", createdDaysAgo: 6, updatedDaysAgo: 4, resolvedDaysAgo: 4,
    comments: [{ author: "Júlia Costa", body: "Senha redefinida e usuário desbloqueado.", daysAgo: 4 }],
  },
  {
    number: "INC-20402", type: "INC", title: "Impressora do 3º andar não imprime",
    description: "Os trabalhos ficam presos na fila da impressora HP do 3º andar.",
    category: "Hardware", priority: "Média", priorityReason: "Atrapalha, mas há alternativa.", status: "aberto",
    requester: "bruno.tavares@nexo.com.br", affected: "equipe", group: "Suporte N1", createdDaysAgo: 1.1, updatedDaysAgo: 1.1,
  },
  {
    number: "REQ-10450", type: "REQ", title: "Instalação do Power BI Desktop",
    description: "Preciso do Power BI Desktop para os relatórios de vendas.",
    category: "Software", priority: "Baixa", priorityReason: "Pedido ou melhoria sem urgência.", status: "aberto",
    requester: "diego.ramos@nexo.com.br", affected: "individual", group: "Suporte N1", createdDaysAgo: 2, updatedDaysAgo: 2,
  },
  {
    number: "INC-20380", type: "INC", title: "Wi-Fi do 2º andar instável",
    description: "A rede Nexo-Corp cai várias vezes por hora na ala norte do 2º andar.",
    category: "Rede e VPN", priority: "Crítica", priorityReason: "Algo parado para uma equipe.", status: "em_andamento",
    requester: "elisa.prado@nexo.com.br", affected: "equipe", group: "Plantão", createdDaysAgo: 0.2, updatedDaysAgo: 0.05,
  },
];

export const SEED_ARTICLES: { code: string; title: string; body: string; category: Category; tags: string[] }[] = [
  { code: "KB-001", title: "VPN com erro 809", category: "Rede e VPN", tags: ["vpn", "809", "erro", "conectar", "windows 10", "home office"],
    body: "Reinstale o cliente de VPN pelo Portal de Softwares e reinicie o computador. Vale apenas para Windows 10; no Windows 11, abra um chamado." },
  { code: "KB-002", title: "Horário do service desk", category: "Outros", tags: ["horario", "atendimento", "plantao", "service desk", "contato", "ramal 4000"],
    body: "O service desk atende de segunda a sexta, das 8h às 18h. Chamados críticos têm plantão 24 horas." },
  { code: "KB-003", title: "Como redefinir a senha da rede", category: "Acesso", tags: ["senha", "redefinir", "esqueci", "expirada", "bloqueada", "rede", "login"],
    body: "Acesse senha.nexo.com.br, informe seu e-mail corporativo e siga o código enviado ao celular cadastrado. A nova senha vale para rede, e-mail e VPN. Se o celular não estiver cadastrado, abra um chamado de Acesso." },
  { code: "KB-004", title: "Senha do SAP bloqueada", category: "Acesso", tags: ["sap", "senha", "bloqueado", "bloqueada", "acesso", "login"],
    body: "Após 5 tentativas o usuário do SAP é bloqueado. O desbloqueio automático acontece em 30 minutos. Se precisar antes, ou se continuar bloqueado, abra um chamado de Acesso." },
  { code: "KB-005", title: "Configurar o Outlook no celular", category: "E-mail", tags: ["outlook", "email", "e-mail", "celular", "sincronizar", "android", "iphone"],
    body: "Instale o Outlook pela loja do celular, entre com o e-mail corporativo e aprove o acesso no Microsoft Authenticator. Na primeira vez, mantenha o app aberto por alguns minutos para sincronizar." },
  { code: "KB-006", title: "Notebook lento", category: "Hardware", tags: ["lento", "lentidao", "travando", "notebook", "computador", "desempenho", "atualizacao"],
    body: "Reinicie o notebook, instale as atualizações pendentes do Windows e rode o Diagnóstico Nexo no Portal de Softwares. Se continuar lento, abra um chamado de Hardware informando o que já tentou." },
  { code: "KB-007", title: "Wi-Fi corporativo", category: "Rede e VPN", tags: ["wifi", "wi-fi", "rede", "internet", "sem fio", "visitante", "conexao"],
    body: "Funcionários usam a rede Nexo-Corp com o login da rede. Visitantes usam a Nexo-Guest, com senha diária na recepção. Se a Nexo-Corp cair para vários colegas, abra um chamado de Rede e VPN informando o andar." },
  { code: "KB-008", title: "Solicitar acesso a pastas e sistemas", category: "Acesso", tags: ["acesso", "permissao", "pasta", "sharepoint", "sistema", "requisicao"],
    body: "Acessos a pastas de rede, SharePoint e sistemas são requisições (REQ) e precisam da aprovação do gestor da área dona da pasta. Informe o caminho exato e o motivo." },
  { code: "KB-009", title: "Solicitar equipamento", category: "Hardware", tags: ["equipamento", "monitor", "mouse", "teclado", "headset", "pedido", "home office"],
    body: "Monitores, mouses, headsets e outros equipamentos são requisições (REQ) com aprovação do gestor. A entrega leva até 5 dias úteis depois da aprovação." },
  { code: "KB-010", title: "Impressora não imprime", category: "Hardware", tags: ["impressora", "imprimir", "fila", "impressao", "papel"],
    body: "Cancele os documentos presos na fila, desligue e ligue a impressora e tente de novo. Se a impressora mostrar erro ou não imprimir para ninguém do andar, abra um chamado de Hardware." },
];
