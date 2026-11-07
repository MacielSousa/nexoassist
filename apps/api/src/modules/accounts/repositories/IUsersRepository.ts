import type { ICreateUserDTO, IUpdateUserDTO } from "../dtos/ICreateUserDTO";
import type { UserRole } from "../dtos/UserRole";
import type { User } from "../infra/typeorm/entities/User";

export interface IListUsersFilter {
  role?: UserRole;
  search?: string;
  active?: boolean;
}

export interface IUsersRepository {
  create(data: ICreateUserDTO): Promise<User>;
  update(id: string, data: IUpdateUserDTO): Promise<User>;
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findByIds(ids: string[]): Promise<User[]>;
  list(filter: IListUsersFilter): Promise<User[]>;
}
