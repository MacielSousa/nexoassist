import { randomUUID } from "node:crypto";
import type { ICreateUserDTO, IUpdateUserDTO } from "@modules/accounts/dtos/ICreateUserDTO";
import { User } from "@modules/accounts/infra/typeorm/entities/User";
import type { IListUsersFilter, IUsersRepository } from "../IUsersRepository";

export class UsersRepositoryInMemory implements IUsersRepository {
  users: User[] = [];

  async create(data: ICreateUserDTO): Promise<User> {
    const user = Object.assign(new User(), {
      ...data,
      id: randomUUID(),
      team: data.team ?? null,
      active: true,
      avatarFileId: null,
      passwordChangedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    this.users.push(user);
    return user;
  }

  async update(id: string, data: IUpdateUserDTO): Promise<User> {
    const user = this.users.find((u) => u.id === id)!;
    // Como no repositório real: campos undefined não sobrescrevem nada.
    const changes = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined));
    Object.assign(user, changes, { updatedAt: new Date() });
    if (data.password) user.passwordChangedAt = new Date();
    return user;
  }

  async findById(id: string) {
    return this.users.find((u) => u.id === id) ?? null;
  }

  async findByEmail(email: string) {
    return this.users.find((u) => u.email === email.trim().toLowerCase()) ?? null;
  }

  async findByIds(ids: string[]) {
    return this.users.filter((u) => ids.includes(u.id));
  }

  async list({ role, search, active }: IListUsersFilter) {
    const q = search?.toLowerCase();
    return this.users
      .filter((u) => (!role || u.role === role) && (active === undefined || u.active === active))
      .filter((u) => !q || u.name.toLowerCase().includes(q) || u.email.includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }
}
