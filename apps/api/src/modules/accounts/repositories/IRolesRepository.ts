import type { Permission as PermissionKey } from "../dtos/permissions";
import type { Permission } from "../infra/typeorm/entities/Permission";
import type { Role } from "../infra/typeorm/entities/Role";

export interface ISaveRoleDTO {
  key: string;
  name: string;
  description: string;
  permissions: PermissionKey[];
}

/** Roles sempre com as permissões carregadas. */
export interface IRolesRepository {
  list(): Promise<(Role & { userCount: number })[]>;
  findById(id: string): Promise<Role | null>;
  findByKey(key: string): Promise<Role | null>;
  findByName(name: string): Promise<Role | null>;
  create(data: ISaveRoleDTO): Promise<Role>;
  update(id: string, data: Partial<ISaveRoleDTO>): Promise<Role>;
  delete(id: string): Promise<void>;
  countUsers(roleId: string): Promise<number>;
  listPermissions(): Promise<Permission[]>;
}
