import { inject, injectable } from "tsyringe";
import { UserMap, type IUserResponseDTO } from "@modules/accounts/mapper/UserMap";
import type { IListUsersFilter, IUsersRepository } from "@modules/accounts/repositories/IUsersRepository";

@injectable()
export class ListUsersUseCase {
  constructor(@inject("UsersRepository") private usersRepository: IUsersRepository) {}

  async execute(filter: IListUsersFilter): Promise<IUserResponseDTO[]> {
    return (await this.usersRepository.list(filter)).map(UserMap.toDTO);
  }
}
