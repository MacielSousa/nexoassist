import type { ICreateUserDTO, IUpdateUserDTO } from "../dtos/ICreateUserDTO";
import type { Permission } from "../dtos/permissions";
import type { SupportTeam } from "../dtos/UserRole";
import type { User } from "../infra/typeorm/entities/User";

export interface IListUsersFilter {
  roleId?: string;
  search?: string;
  active?: boolean;
}

/** Acesso completo de um usuário: roles (macro) + permissões diretas (micro) + fila. */
export interface IUserAccess {
  roleIds: string[];
  permissions: Permission[];
  team: SupportTeam | null;
}

/** Todos os métodos devolvem o usuário com as roles (e suas permissões) e as permissões diretas. */
export interface IUsersRepository {
  create(data: ICreateUserDTO): Promise<User>;
  update(id: string, data: IUpdateUserDTO): Promise<User>;
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findByIds(ids: string[]): Promise<User[]>;
  list(filter: IListUsersFilter): Promise<User[]>;
  /** Substitui roles, permissões diretas e fila do usuário (tudo ou nada). */
  setAccess(userId: string, access: IUserAccess, grantedById: string): Promise<User>;
  /** Quantos usuários ativos têm a permissão (por alguma role ou concedida direto). */
  countActiveWithPermission(permission: Permission): Promise<number>;
}
