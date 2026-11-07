import { inject, injectable } from "tsyringe";
import type { IActor } from "@modules/accounts/dtos/IActor";
import type { Permission } from "@modules/accounts/dtos/permissions";
import type { SupportTeam } from "@modules/accounts/dtos/UserRole";
import { UserMap, type IUserResponseDTO } from "@modules/accounts/mapper/UserMap";
import type { IRolesRepository } from "@modules/accounts/repositories/IRolesRepository";
import type { IUsersRepository } from "@modules/accounts/repositories/IUsersRepository";
import { AccessGuard } from "@modules/accounts/services/AccessGuard";
import { AppError } from "@shared/errors/AppError";

interface IRequest {
  actor: IActor;
  userId: string;
  /** Macro: roles do usuário. */
  roleIds: string[];
  /** Micro: permissões concedidas direto, fora das roles. */
  permissions: Permission[];
  /** Fila; se omitida, mantém a atual. */
  team?: SupportTeam | null;
}

/**
 * Define o acesso de um usuário de uma vez: as roles (macro) e as permissões diretas (micro).
 * As listas enviadas substituem as atuais. Regras:
 * - ninguém altera o próprio acesso;
 * - só se concede (por role ou direto) o que você mesmo tem, salvo quem tem roles.manage;
 * - quem passa a atender no console precisa de uma fila;
 * - o sistema nunca fica sem alguém que gerencie usuários e roles.
 */
@injectable()
export class SetUserAccessUseCase {
  constructor(
    @inject("UsersRepository") private usersRepository: IUsersRepository,
    @inject("RolesRepository") private rolesRepository: IRolesRepository,
  ) {}

  async execute({ actor, userId, roleIds, permissions, team }: IRequest): Promise<IUserResponseDTO> {
    if (userId === actor.id) throw new AppError("Você não pode alterar o próprio acesso. Peça a outro administrador.");
    const user = await this.usersRepository.findById(userId);
    if (!user) throw new AppError("Usuário não encontrado.", 404);

    const uniqueRoleIds = [...new Set(roleIds)];
    const roles = await Promise.all(uniqueRoleIds.map((id) => this.rolesRepository.findById(id)));
    if (roles.some((r) => !r)) throw new AppError("Role não encontrada.", 422);
    const uniquePermissions = [...new Set(permissions)];

    // Sem escalada: o que está sendo acrescentado (roles novas e permissões diretas novas).
    const currentRoleIds = user.roles.map((r) => r.id);
    const currentDirect = user.directPermissions.map((p) => p.permissionKey as Permission);
    const added = [
      ...roles.filter((r) => !currentRoleIds.includes(r!.id)).flatMap((r) => r!.permissions.map((p) => p.key as Permission)),
      ...uniquePermissions.filter((p) => !currentDirect.includes(p)),
    ];
    AccessGuard.ensureCanGrant(actor, [...new Set(added)]);

    const effective = new Set<Permission>([...roles.flatMap((r) => r!.permissions.map((p) => p.key as Permission)), ...uniquePermissions]);
    const nextTeam = team !== undefined ? team : user.team;
    const attends = effective.has("console.attend");
    if (attends && !nextTeam) throw new AppError("Quem atende no console precisa de uma fila (Suporte N1 ou N2).");

    const previous = { roleIds: currentRoleIds, permissions: currentDirect, team: user.team };
    const updated = await this.usersRepository.setAccess(userId, { roleIds: uniqueRoleIds, permissions: uniquePermissions, team: attends ? nextTeam : null }, actor.id);
    try {
      await AccessGuard.ensureAdminsRemain(this.usersRepository);
    } catch (err) {
      await this.usersRepository.setAccess(userId, previous, actor.id);
      throw err;
    }
    return UserMap.toDTO(updated);
  }
}
