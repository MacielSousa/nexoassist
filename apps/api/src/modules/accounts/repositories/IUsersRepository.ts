import type { ICreateUserDTO, IUpdateUserDTO } from "../dtos/ICreateUserDTO";
import type { Permission } from "../dtos/permissions";
import type { User } from "../infra/typeorm/entities/User";

export interface IListUsersFilter {
  roleId?: string;
  search?: string;
  active?: boolean;
}

/** Todos os métodos devolvem o usuário com a role (e suas permissões) e as permissões extras. */
export interface IUsersRepository {
  create(data: ICreateUserDTO): Promise<User>;
  update(id: string, data: IUpdateUserDTO): Promise<User>;
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findByIds(ids: string[]): Promise<User[]>;
  list(filter: IListUsersFilter): Promise<User[]>;
  /** Substitui as permissões concedidas direto ao usuário. */
  setExtraPermissions(userId: string, permissions: Permission[], grantedById: string): Promise<User>;
  /** Quantos usuários ativos têm a permissão (pela role ou concedida direto). */
  countActiveWithPermission(permission: Permission): Promise<number>;
}
