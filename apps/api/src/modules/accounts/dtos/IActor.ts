import type { User } from "../infra/typeorm/entities/User";
import type { Permission } from "./permissions";

/**
 * Quem está executando a ação. Vem do token (nunca do corpo da requisição nem do LLM),
 * com as permissões efetivas: as da role + as concedidas direto ao usuário.
 */
export interface IActor {
  id: string;
  permissions: Permission[];
}

/** O ator tem pelo menos uma das permissões? */
export const can = (actor: IActor, ...permissions: Permission[]) => permissions.some((p) => actor.permissions.includes(p));

/** Permissões efetivas de um usuário carregado com role e extras. */
export function effectivePermissions(user: User): Permission[] {
  const keys = new Set<string>([...(user.role?.permissions ?? []).map((p) => p.key), ...(user.extraPermissions ?? []).map((p) => p.permissionKey)]);
  return [...keys] as Permission[];
}

export const actorOf = (user: User): IActor => ({ id: user.id, permissions: effectivePermissions(user) });
