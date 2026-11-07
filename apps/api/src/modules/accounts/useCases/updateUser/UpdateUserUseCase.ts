import { inject, injectable } from "tsyringe";
import type { IUpdateUserDTO } from "@modules/accounts/dtos/ICreateUserDTO";
import { UserMap, type IUserResponseDTO } from "@modules/accounts/mapper/UserMap";
import type { IUsersRepository } from "@modules/accounts/repositories/IUsersRepository";
import type { IUsersTokensRepository } from "@modules/accounts/repositories/IUsersTokensRepository";
import type { IHashProvider } from "@shared/container/providers/HashProvider/IHashProvider";
import { AppError } from "@shared/errors/AppError";

interface IRequest extends IUpdateUserDTO {
  id: string;
  /** Admin que está fazendo a alteração. */
  actorId: string;
}

/** Edição pelo admin: dados, perfil, fila, ativação e redefinição de senha. */
@injectable()
export class UpdateUserUseCase {
  constructor(
    @inject("UsersRepository") private usersRepository: IUsersRepository,
    @inject("UsersTokensRepository") private usersTokensRepository: IUsersTokensRepository,
    @inject("HashProvider") private hashProvider: IHashProvider,
  ) {}

  async execute({ id, actorId, ...changes }: IRequest): Promise<IUserResponseDTO> {
    const user = await this.usersRepository.findById(id);
    if (!user) throw new AppError("Usuário não encontrado.", 404);

    // O admin não pode se trancar fora do sistema.
    if (id === actorId && (changes.active === false || (changes.role && changes.role !== "admin"))) {
      throw new AppError("Você não pode desativar nem remover o próprio acesso de admin.");
    }

    const role = changes.role ?? user.role;
    const team = changes.team !== undefined ? changes.team : user.team;
    if (role === "analyst" && !team) throw new AppError("Informe a fila do analista (Suporte N1 ou N2).");

    const updated = await this.usersRepository.update(id, {
      ...changes,
      team: role === "analyst" ? team : null,
      password: changes.password ? await this.hashProvider.generateHash(changes.password) : undefined,
    });

    // Desativar ou trocar a senha encerra as sessões abertas.
    if (changes.active === false || changes.password) await this.usersTokensRepository.deleteByUser(id);
    return UserMap.toDTO(updated);
  }
}
