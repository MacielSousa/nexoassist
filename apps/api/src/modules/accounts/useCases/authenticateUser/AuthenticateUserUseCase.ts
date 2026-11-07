import { inject, injectable } from "tsyringe";
import { UserMap, type IUserResponseDTO } from "@modules/accounts/mapper/UserMap";
import type { IUsersRepository } from "@modules/accounts/repositories/IUsersRepository";
import type { IUsersTokensRepository } from "@modules/accounts/repositories/IUsersTokensRepository";
import { issueSessionTokens, type ISessionTokens } from "@modules/accounts/utils/tokens";
import type { IHashProvider } from "@shared/container/providers/HashProvider/IHashProvider";
import { AppError } from "@shared/errors/AppError";

interface IRequest {
  email: string;
  password: string;
}

interface IResponse extends ISessionTokens {
  user: IUserResponseDTO;
}

@injectable()
export class AuthenticateUserUseCase {
  constructor(
    @inject("UsersRepository") private usersRepository: IUsersRepository,
    @inject("UsersTokensRepository") private usersTokensRepository: IUsersTokensRepository,
    @inject("HashProvider") private hashProvider: IHashProvider,
  ) {}

  async execute({ email, password }: IRequest): Promise<IResponse> {
    const user = await this.usersRepository.findByEmail(email);
    // Mesma mensagem para e-mail ou senha errados: não revela quais e-mails existem.
    const valid = user && (await this.hashProvider.compareHash(password, user.password));
    if (!user || !valid) throw new AppError("E-mail ou senha incorretos.", 401);
    if (!user.active) throw new AppError("Usuário desativado. Procure a TI.", 403);

    const tokens = await issueSessionTokens(user, this.usersTokensRepository);
    return { ...tokens, user: UserMap.toDTO(user) };
  }
}
