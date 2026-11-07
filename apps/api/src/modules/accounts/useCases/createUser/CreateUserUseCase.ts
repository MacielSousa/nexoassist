import { inject, injectable } from "tsyringe";
import type { IActor } from "@modules/accounts/dtos/IActor";
import type { ICreateUserDTO } from "@modules/accounts/dtos/ICreateUserDTO";
import type { Permission } from "@modules/accounts/dtos/permissions";
import { UserMap, type IUserResponseDTO } from "@modules/accounts/mapper/UserMap";
import type { IRolesRepository } from "@modules/accounts/repositories/IRolesRepository";
import type { IUsersRepository } from "@modules/accounts/repositories/IUsersRepository";
import { AccessGuard } from "@modules/accounts/services/AccessGuard";
import type { IHashProvider } from "@shared/container/providers/HashProvider/IHashProvider";
import { AppError } from "@shared/errors/AppError";

/** Cadastro de usuários (quem tem users.manage). A role define o que a pessoa pode fazer. */
@injectable()
export class CreateUserUseCase {
  constructor(
    @inject("UsersRepository") private usersRepository: IUsersRepository,
    @inject("RolesRepository") private rolesRepository: IRolesRepository,
    @inject("HashProvider") private hashProvider: IHashProvider,
  ) {}

  async execute({ actor, ...data }: ICreateUserDTO & { actor: IActor }): Promise<IUserResponseDTO> {
    const email = data.email.trim().toLowerCase();
    if (await this.usersRepository.findByEmail(email)) throw new AppError("Já existe um usuário com esse e-mail.", 409);

    const role = await this.rolesRepository.findById(data.roleId);
    if (!role) throw new AppError("Role não encontrada.", 422);
    const rolePermissions = role.permissions.map((p) => p.key) as Permission[];
    AccessGuard.ensureCanGrant(actor, rolePermissions);

    // Quem atende no console precisa de uma fila (N1/N2) para receber transferências.
    const attends = rolePermissions.includes("console.attend");
    if (attends && !data.team) throw new AppError("Informe a fila de atendimento (Suporte N1 ou N2).");

    const user = await this.usersRepository.create({
      ...data,
      email,
      name: data.name.trim(),
      team: attends ? data.team : null,
      password: await this.hashProvider.generateHash(data.password),
    });
    return UserMap.toDTO(user);
  }
}
