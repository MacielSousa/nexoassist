import { randomUUID } from "node:crypto";
import { PERMISSIONS, SYSTEM_ROLES } from "@modules/accounts/dtos/permissions";
import { Permission } from "@modules/accounts/infra/typeorm/entities/Permission";
import { Role } from "@modules/accounts/infra/typeorm/entities/Role";
import type { IRolesRepository, ISaveRoleDTO } from "../IRolesRepository";

const permissionEntity = (key: string) => Object.assign(new Permission(), PERMISSIONS.find((p) => p.key === key));

/** Começa com as três roles de sistema (admin, analyst, employee), como depois da migration. */
export class RolesRepositoryInMemory implements IRolesRepository {
  roles: Role[] = SYSTEM_ROLES.map((r) =>
    Object.assign(new Role(), {
      id: randomUUID(),
      key: r.key,
      name: r.name,
      description: r.description,
      isSystem: true,
      permissions: r.permissions.map(permissionEntity),
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
  );
  /** Contagem de usuários por role, informada pelo repositório de usuários em memória. */
  countUsersFn: (roleId: string) => number = () => 0;

  idOf(key: string) {
    return this.roles.find((r) => r.key === key)!.id;
  }

  async list() {
    return this.roles.map((r) => Object.assign(r, { userCount: this.countUsersFn(r.id) }));
  }

  async findById(id: string) {
    return this.roles.find((r) => r.id === id) ?? null;
  }

  async findByKey(key: string) {
    return this.roles.find((r) => r.key === key) ?? null;
  }

  async findByName(name: string) {
    return this.roles.find((r) => r.name === name) ?? null;
  }

  async create(data: ISaveRoleDTO) {
    const role = Object.assign(new Role(), { ...data, id: randomUUID(), isSystem: false, permissions: data.permissions.map(permissionEntity), createdAt: new Date(), updatedAt: new Date() });
    this.roles.push(role);
    return role;
  }

  async update(id: string, data: Partial<ISaveRoleDTO>) {
    const role = this.roles.find((r) => r.id === id)!;
    if (data.name !== undefined) role.name = data.name;
    if (data.description !== undefined) role.description = data.description;
    if (data.permissions) role.permissions = data.permissions.map(permissionEntity);
    return role;
  }

  async delete(id: string) {
    this.roles = this.roles.filter((r) => r.id !== id);
  }

  async countUsers(roleId: string) {
    return this.countUsersFn(roleId);
  }

  async listPermissions() {
    return PERMISSIONS.map((p) => permissionEntity(p.key));
  }
}
