export const USER_ROLES = ["admin", "analyst", "employee"] as const;
export type UserRole = (typeof USER_ROLES)[number];

/** Filas de atendimento dos analistas. */
export const SUPPORT_TEAMS = ["Suporte N1", "Suporte N2"] as const;
export type SupportTeam = (typeof SUPPORT_TEAMS)[number];
