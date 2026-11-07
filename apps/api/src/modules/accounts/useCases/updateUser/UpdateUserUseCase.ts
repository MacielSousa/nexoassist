import { inject, injectable } from "tsyringe";
import { effectivePermissions, type IActor } from "@modules/accounts/dtos/IActor";
import type { IUpdateUserDTO } from "@modules/accounts/dtos/ICreateUserDTO";
import { UserMap, type IUserResponseDTO } from "@modules/accounts/mapper/UserMap";
import type { IUsersRepository } from "@modules/accounts/repositories/IUsersRepository";
import type { IUsersTokensRepository } from "@modules/accounts/repositories/IUsersTokensRepository";
import { AccessGuard } from "@modules/accounts/services/AccessGuard";
import type { IHashProvider } from "@shared/container/providers/HashProvider/IHashProvider";
import { AppError } from "@shared/errors/AppError";

interface IRequest extends Omit<IUpdateUserDTO, "email" | "avatarFileId"> {
  id: string;
  actor: IActor;
}

/**
 * Edição administrativa: dados, fila, ativação e redefinição de senha.
 * Roles e permissões ficam no acesso do usuário (SetUserAccessUseCase).
 */
@injectable()
export class UpdateUserUseCase {
  constructor(
    @inject("UsersRepository") private usersRepository: IUsersRepository,
    @inject("UsersTokensRepository") private usersTokensRepository: IUsersTokensRepository,
    @inject("HashProvider") private hashProvider: IHashProvider,
  ) {}

  async execute({ id, actor, ...changes }: IRequest): Promise<IUserResponseDTO> {
    const user = await this.usersRepository.findById(id);
    if (!user) throw new AppError("Usuário não encontrado.", 404);

    // Ninguém se desativa por aqui (evita se trancar fora por engano).
    if (id === actor.id && changes.active === false) throw new AppError("Você não pode se desativar.");

    const attends = effectivePermissions(user).includes("console.attend");
    const team = changes.team !== undefined ? changes.team : user.team;
    if (attends && !team) throw new AppError("Informe a fila de atendimento (Suporte N1 ou N2).");

    const previous = { active: user.active };
    const updated = await this.usersRepository.update(id, {
      ...changes,
      team: attends ? team : null,
      password: changes.password ? await this.hashProvider.generateHash(changes.password) : undefined,
    });

    // Se desativar deixou o sistema sem administradores, desfaz.
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
