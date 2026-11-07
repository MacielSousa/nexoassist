import { can, type IActor } from "../dtos/IActor";
import { PERMISSIONS, type Permission } from "../dtos/permissions";
import type { IUsersRepository } from "../repositories/IUsersRepository";
import { AppError } from "@shared/errors/AppError";

const describe = (p: Permission) => PERMISSIONS.find((x) => x.key === p)?.description ?? p;

/**
 * Regras de segurança do controle de acesso, usadas por todos os use cases que mexem em
 * roles e permissões.
 */
export const AccessGuard = {
  /**
   * Sem escalada de privilégio: só dá para conceder (direto ou via role) permissões que você
   * mesmo tem. Quem tem roles.manage pode conceder qualquer uma.
   */
  ensureCanGrant(actor: IActor, permissions: Permission[]) {
    if (can(actor, "roles.manage")) return;
    const missing = permissions.filter((p) => !actor.permissions.includes(p));
    if (missing.length) {
      throw new AppError(`Você não pode conceder permissões que não tem: ${missing.map(describe).join("; ")}.`, 403);
    }
  },

  /** Ninguém tranca o sistema: sempre sobra alguém ativo que gerencia usuários e roles. */
  async ensureAdminsRemain(users: IUsersRepository) {
    for (const p of ["users.manage", "roles.manage"] as const) {
      if ((await users.countActiveWithPermission(p)) === 0) {
        throw new AppError(`A alteração deixaria o sistema sem ninguém com a permissão "${describe(p)}".`, 409);
      }
    }
  },
};
