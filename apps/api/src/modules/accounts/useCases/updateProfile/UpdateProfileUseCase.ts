import { inject, injectable } from "tsyringe";
import { UserMap, type IUserResponseDTO } from "@modules/accounts/mapper/UserMap";
import type { IUsersRepository } from "@modules/accounts/repositories/IUsersRepository";
import type { IUsersTokensRepository } from "@modules/accounts/repositories/IUsersTokensRepository";
import type { IHashProvider } from "@shared/container/providers/HashProvider/IHashProvider";
import { AppError } from "@shared/errors/AppError";

interface IRequest {
  userId: string;
  name?: string;
  department?: string;
  email?: string;
  /** Obrigatória para trocar o e-mail: confirma que é a própria pessoa. */
  currentPassword?: string;
}

/**
 * O próprio usuário edita o perfil. Nome e área: livre. E-mail (que é o login): exige a senha
 * atual e encerra as outras sessões. A senha tem um caso de uso próprio (ChangePassword).
 */
@injectable()
export class UpdateProfileUseCase {
  constructor(
    @inject("UsersRepository") private users: IUsersRepository,
    @inject("UsersTokensRepository") private tokens: IUsersTokensRepository,
    @inject("HashProvider") private hash: IHashProvider,
  ) {}

  async execute({ userId, name, department, email, currentPassword }: IRequest): Promise<IUserResponseDTO> {
    const user = await this.users.findById(userId);
    if (!user || !user.active) throw new AppError("Usuário não encontrado.", 404);

    const newEmail = email?.trim().toLowerCase();
    const emailChanged = newEmail !== undefined && newEmail !== user.email;
    if (emailChanged) {
      if (!currentPassword || !(await this.hash.compareHash(currentPassword, user.password))) {
        throw new AppError("Para trocar o e-mail, confirme com a sua senha atual.", 403);
      }
      if (await this.users.findByEmail(newEmail)) throw new AppError("Já existe um usuário com esse e-mail.", 409);
    }

    const updated = await this.users.update(userId, {
      name: name?.trim(),
      department: department?.trim(),
      email: emailChanged ? newEmail : undefined,
    });
    if (emailChanged) await this.tokens.deleteByUser(userId);
    return UserMap.toDTO(updated);
  }
}
