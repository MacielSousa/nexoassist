import { inject, injectable } from "tsyringe";
import type { IActor } from "@modules/accounts/dtos/IActor";
import type { IUpdateUserDTO } from "@modules/accounts/dtos/ICreateUserDTO";
import type { Permission } from "@modules/accounts/dtos/permissions";
import { UserMap, type IUserResponseDTO } from "@modules/accounts/mapper/UserMap";
import type { IRolesRepository } from "@modules/accounts/repositories/IRolesRepository";
import type { IUsersRepository } from "@modules/accounts/repositories/IUsersRepository";
import type { IUsersTokensRepository } from "@modules/accounts/repositories/IUsersTokensRepository";
import { AccessGuard } from "@modules/accounts/services/AccessGuard";
import type { IHashProvider } from "@shared/container/providers/HashProvider/IHashProvider";
import { AppError } from "@shared/errors/AppError";

interface IRequest extends Omit<IUpdateUserDTO, "email" | "avatarFileId"> {
  id: string;
  actor: IActor;
}

/** Edição administrativa: dados, role, fila, ativação e redefinição de senha. */
@injectable()
export class UpdateUserUseCase {
  constructor(
    @inject("UsersRepository") private usersRepository: IUsersRepository,
    @inject("RolesRepository") private rolesRepository: IRolesRepository,
    @inject("UsersTokensRepository") private usersTokensRepository: IUsersTokensRepository,
    @inject("HashProvider") private hashProvider: IHashProvider,
  ) {}

  async execute({ id, actor, ...changes }: IRequest): Promise<IUserResponseDTO> {
    const user = await this.usersRepository.findById(id);
    if (!user) throw new AppError("Usuário não encontrado.", 404);

    // Ninguém mexe no próprio acesso por aqui (evita se trancar fora por engano).
    if (id === actor.id && ((changes.roleId && changes.roleId !== user.roleId) || changes.active === false)) {
      throw new AppError("Você não pode trocar a própria role nem se desativar.");
    }

    let role = user.role;
    if (changes.roleId && changes.roleId !== user.roleId) {
      const next = await this.rolesRepository.findById(changes.roleId);
      if (!next) throw new AppError("Role não encontrada.", 422);
      AccessGuard.ensureCanGrant(actor, next.permissions.map((p) => p.key) as Permission[]);
      role = next;
    }

    const attends = role.permissions.some((p) => p.key === "console.attend") || user.extraPermissions.some((p) => p.permissionKey === "console.attend");
    const team = changes.team !== undefined ? changes.team : user.team;
    if (attends && !team) throw new AppError("Informe a fila de atendimento (Suporte N1 ou N2).");

    const previous = { roleId: user.roleId, active: user.active };
    const updated = await this.usersRepository.update(id, {
      ...changes,
      team: attends ? team : null,
      password: changes.password ? await this.hashProvider.generateHash(changes.password) : undefined,
    });

    // Se a mudança deixou o sistema sem administradores, desfaz.
    try {
      await AccessGuard.ensureAdminsRemain(this.usersRepository);
    } catch (err) {
      await this.usersRepository.update(id, previous);
      throw err;
    }

    // Desativar ou trocar a senha encerra as sessões abertas.
    if (changes.active === false || changes.password) await this.usersTokensRepository.deleteByUser(id);
    return UserMap.toDTO(updated);
  }
}
