import { inject, injectable } from "tsyringe";
import type { ICreateUserDTO } from "@modules/accounts/dtos/ICreateUserDTO";
import { UserMap, type IUserResponseDTO } from "@modules/accounts/mapper/UserMap";
import type { IUsersRepository } from "@modules/accounts/repositories/IUsersRepository";
import type { IHashProvider } from "@shared/container/providers/HashProvider/IHashProvider";
import { AppError } from "@shared/errors/AppError";

/** Cadastro feito pelo admin: funcionários, analistas e outros admins. */
@injectable()
export class CreateUserUseCase {
  constructor(
    @inject("UsersRepository") private usersRepository: IUsersRepository,
    @inject("HashProvider") private hashProvider: IHashProvider,
  ) {}

  async execute(data: ICreateUserDTO): Promise<IUserResponseDTO> {
    const email = data.email.trim().toLowerCase();
    if (await this.usersRepository.findByEmail(email)) throw new AppError("Já existe um usuário com esse e-mail.", 409);
    if (data.role === "analyst" && !data.team) throw new AppError("Informe a fila do analista (Suporte N1 ou N2).");

    const user = await this.usersRepository.create({
      ...data,
      email,
      name: data.name.trim(),
      team: data.role === "analyst" ? data.team : null,
      password: await this.hashProvider.generateHash(data.password),
    });
    return UserMap.toDTO(user);
  }
}
