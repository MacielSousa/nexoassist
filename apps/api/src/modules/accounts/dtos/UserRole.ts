/** Filas de atendimento de quem atende no console. */
export const SUPPORT_TEAMS = ["Suporte N1", "Suporte N2"] as const;
export type SupportTeam = (typeof SUPPORT_TEAMS)[number];
