import { ILike, In, type FindOptionsWhere, type Repository } from "typeorm";
import type { ICreateUserDTO, IUpdateUserDTO } from "@modules/accounts/dtos/ICreateUserDTO";
import type { Permission } from "@modules/accounts/dtos/permissions";
import type { IListUsersFilter, IUsersRepository } from "@modules/accounts/repositories/IUsersRepository";
import { AppDataSource } from "@shared/infra/typeorm/data-source";
import { User } from "../entities/User";
import { UserPermission } from "../entities/UserPermission";

/** Relações carregadas em toda busca: a role com as permissões e as permissões extras. */
const relations = { role: { permissions: true }, extraPermissions: true };

export class UsersRepository implements IUsersRepository {
  private repository: Repository<User>;

  constructor() {
    this.repository = AppDataSource.getRepository(User);
  }

  async create(data: ICreateUserDTO): Promise<User> {
    const { id } = await this.repository.save(this.repository.create({ ...data, team: data.team ?? null, passwordChangedAt: new Date() }));
    return (await this.findById(id))!;
  }

  async update(id: string, data: IUpdateUserDTO): Promise<User> {
    // Campos ausentes (undefined) não devem sobrescrever nada.
    const changes = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined)) as Partial<User>;
    if (data.password) changes.passwordChangedAt = new Date();
    await this.repository.update(id, changes);
    return (await this.findById(id))!;
  }

  findById(id: string): Promise<User | null> {
    return this.repository.findOne({ where: { id }, relations });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.repository.findOne({ where: { email: email.trim().toLowerCase() }, relations });
  }

  findByIds(ids: string[]): Promise<User[]> {
    return ids.length ? this.repository.find({ where: { id: In(ids) }, relations }) : Promise.resolve([]);
  }

  list({ roleId, search, active }: IListUsersFilter): Promise<User[]> {
    const base: FindOptionsWhere<User> = {};
    if (roleId) base.roleId = roleId;
    if (active !== undefined) base.active = active;
    const where = search ? [{ ...base, name: ILike(`%${search}%`) }, { ...base, email: ILike(`%${search}%`) }] : base;
    return this.repository.find({ where, relations, order: { name: "ASC" } });
  }

  async setExtraPermissions(userId: string, permissions: Permission[], grantedById: string): Promise<User> {
    await AppDataSource.transaction(async (tx) => {
      await tx.delete(UserPermission, { userId });
      if (permissions.length) {
        await tx.insert(
          UserPermission,
          permissions.map((permissionKey) => ({ userId, permissionKey, grantedById })),
        );
      }
    });
    return (await this.findById(userId))!;
  }

  async countActiveWithPermission(permission: Permission): Promise<number> {
    const [row] = (await AppDataSource.query(
      `SELECT COUNT(DISTINCT u.id)::int AS count FROM users u
       WHERE u.active AND (
         EXISTS (SELECT 1 FROM role_permissions rp WHERE rp.role_id = u.role_id AND rp.permission_key = $1)
         OR EXISTS (SELECT 1 FROM user_permissions up WHERE up.user_id = u.id AND up.permission_key = $1)
       )`,
      [permission],
    )) as { count: number }[];
    return row!.count;
  }
}
