import { inject, injectable } from "tsyringe";
import type { IActor } from "@modules/accounts/dtos/IActor";
import type { Permission } from "@modules/accounts/dtos/permissions";
import { UserMap, type IUserResponseDTO } from "@modules/accounts/mapper/UserMap";
import type { IUsersRepository } from "@modules/accounts/repositories/IUsersRepository";
import { AccessGuard } from "@modules/accounts/services/AccessGuard";
import { AppError } from "@shared/errors/AppError";

/**
 * Concede permissões direto a um usuário, além das da role (ex.: um funcionário que também
 * pode ver relatórios). A lista enviada substitui a atual.
 */
@injectable()
export class SetUserPermissionsUseCase {
  constructor(@inject("UsersRepository") private usersRepository: IUsersRepository) {}

  async execute({ actor, userId, permissions }: { actor: IActor; userId: string; permissions: Permission[] }): Promise<IUserResponseDTO> {
    const user = await this.usersRepository.findById(userId);
    if (!user) throw new AppError("Usuário não encontrado.", 404);

    const current = user.extraPermissions.map((p) => p.permissionKey as Permission);
    const added = permissions.filter((p) => !current.includes(p));
    AccessGuard.ensureCanGrant(actor, added);

    const unique = [...new Set(permissions)];
    const updated = await this.usersRepository.setExtraPermissions(userId, unique, actor.id);
    try {
      await AccessGuard.ensureAdminsRemain(this.usersRepository);
    } catch (err) {
      await this.usersRepository.setExtraPermissions(userId, current, actor.id);
      throw err;
    }
    return UserMap.toDTO(updated);
  }
}
