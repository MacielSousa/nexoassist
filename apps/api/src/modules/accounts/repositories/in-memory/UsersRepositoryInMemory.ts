import { randomUUID } from "node:crypto";
import { actorOf, effectivePermissions, type IActor } from "@modules/accounts/dtos/IActor";
import type { ICreateUserDTO, IUpdateUserDTO } from "@modules/accounts/dtos/ICreateUserDTO";
import type { Permission } from "@modules/accounts/dtos/permissions";
import { User } from "@modules/accounts/infra/typeorm/entities/User";
import { UserPermission } from "@modules/accounts/infra/typeorm/entities/UserPermission";
import type { IListUsersFilter, IUsersRepository } from "../IUsersRepository";
import { RolesRepositoryInMemory } from "./RolesRepositoryInMemory";

export class UsersRepositoryInMemory implements IUsersRepository {
  users: User[] = [];

  constructor(readonly roles = new RolesRepositoryInMemory()) {
    roles.countUsersFn = (roleId) => this.users.filter((u) => u.roleId === roleId).length;
  }

  /** Preenche a role, como o TypeORM faria com as relações. */
  private hydrate(user: User) {
    user.role = this.roles.roles.find((r) => r.id === user.roleId)!;
    return user;
  }

  async create(data: ICreateUserDTO): Promise<User> {
    const user = Object.assign(new User(), {
      ...data,
      id: randomUUID(),
      team: data.team ?? null,
      active: true,
      avatarFileId: null,
      extraPermissions: [],
      passwordChangedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    this.users.push(user);
    return this.hydrate(user);
  }

  async update(id: string, data: IUpdateUserDTO): Promise<User> {
    const user = this.users.find((u) => u.id === id)!;
    // Como no repositório real: campos undefined não sobrescrevem nada.
    const changes = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined));
    Object.assign(user, changes, { updatedAt: new Date() });
    if (data.password) user.passwordChangedAt = new Date();
    return this.hydrate(user);
  }

  async findById(id: string) {
    const user = this.users.find((u) => u.id === id);
    return user ? this.hydrate(user) : null;
  }

  async findByEmail(email: string) {
    const user = this.users.find((u) => u.email === email.trim().toLowerCase());
    return user ? this.hydrate(user) : null;
  }

  async findByIds(ids: string[]) {
    return this.users.filter((u) => ids.includes(u.id)).map((u) => this.hydrate(u));
  }

  async list({ roleId, search, active }: IListUsersFilter) {
    const q = search?.toLowerCase();
    return this.users
      .filter((u) => (!roleId || u.roleId === roleId) && (active === undefined || u.active === active))
      .filter((u) => !q || u.name.toLowerCase().includes(q) || u.email.includes(q))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((u) => this.hydrate(u));
  }

  async setExtraPermissions(userId: string, permissions: Permission[], grantedById: string) {
    const user = this.users.find((u) => u.id === userId)!;
    user.extraPermissions = permissions.map((permissionKey) => Object.assign(new UserPermission(), { userId, permissionKey, grantedById, createdAt: new Date() }));
    return this.hydrate(user);
  }

  async countActiveWithPermission(permission: Permission) {
    return this.users.filter((u) => u.active && effectivePermissions(this.hydrate(u)).includes(permission)).length;
  }

  // ---- Atalhos para os testes ----

  /** Cria um usuário com a role de sistema informada e devolve o ator correspondente. */
  async createActor(name: string, roleKey: "admin" | "analyst" | "employee", extra: Partial<ICreateUserDTO> = {}): Promise<IActor> {
    const user = await this.create({
      name,
      email: `${name.toLowerCase().replace(/\s+/g, ".")}@nexo.com.br`,
      password: "hashed:senha-atual",
      roleId: this.roles.idOf(roleKey),
      department: "TI",
      team: roleKey === "analyst" ? "Suporte N2" : null,
      ...extra,
    });
    return actorOf(user);
  }
}
