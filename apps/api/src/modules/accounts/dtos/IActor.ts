import type { UserRole } from "./UserRole";

/** Quem está executando a ação (vem do token, nunca do corpo da requisição nem do LLM). */
export interface IActor {
  id: string;
  role: UserRole;
}

export const isStaff = (actor: IActor) => actor.role === "analyst" || actor.role === "admin";
