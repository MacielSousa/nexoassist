import { ILike, In, type FindOptionsWhere, type Repository } from "typeorm";
import type { ICreateUserDTO, IUpdateUserDTO } from "@modules/accounts/dtos/ICreateUserDTO";
import type { IListUsersFilter, IUsersRepository } from "@modules/accounts/repositories/IUsersRepository";
import { AppDataSource } from "@shared/infra/typeorm/data-source";
import { User } from "../entities/User";

export class UsersRepository implements IUsersRepository {
  private repository: Repository<User>;

  constructor() {
    this.repository = AppDataSource.getRepository(User);
  }

  async create(data: ICreateUserDTO): Promise<User> {
    const user = this.repository.create({ ...data, team: data.team ?? null, passwordChangedAt: new Date() });
    return this.repository.save(user);
  }

  async update(id: string, data: IUpdateUserDTO): Promise<User> {
    // Campos ausentes (undefined) não devem sobrescrever nada.
    const changes = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined)) as Partial<User>;
    if (data.password) changes.passwordChangedAt = new Date();
    await this.repository.update(id, changes);
    return (await this.findById(id))!;
  }

  findById(id: string): Promise<User | null> {
    return this.repository.findOneBy({ id });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.repository.findOneBy({ email: email.trim().toLowerCase() });
  }

  findByIds(ids: string[]): Promise<User[]> {
    return ids.length ? this.repository.findBy({ id: In(ids) }) : Promise.resolve([]);
  }

  list({ role, search, active }: IListUsersFilter): Promise<User[]> {
    const base: FindOptionsWhere<User> = {};
    if (role) base.role = role;
    if (active !== undefined) base.active = active;
    const where = search ? [{ ...base, name: ILike(`%${search}%`) }, { ...base, email: ILike(`%${search}%`) }] : base;
    return this.repository.find({ where, order: { name: "ASC" } });
  }
}
