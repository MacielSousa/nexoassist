import { ILike, In, type FindOptionsWhere, type Repository } from "typeorm";
import type { ICreateUserDTO, IUpdateUserDTO } from "@modules/accounts/dtos/ICreateUserDTO";
import type { Permission } from "@modules/accounts/dtos/permissions";
import type { IListUsersFilter, IUserAccess, IUsersRepository } from "@modules/accounts/repositories/IUsersRepository";
import { AppDataSource } from "@shared/infra/typeorm/data-source";
import { User } from "../entities/User";
import { UserPermission } from "../entities/UserPermission";

/** Relações carregadas em toda busca: as roles com as permissões e as permissões diretas. */
const relations = { roles: { permissions: true }, directPermissions: true };

/** SQL: o usuário `u` tem a permissão $1, por alguma role ou concedida direto? */
export const HAS_PERMISSION_SQL = (param: string) => `(
  EXISTS (SELECT 1 FROM user_roles ur JOIN role_permissions rp ON rp.role_id = ur.role_id
          WHERE ur.user_id = u.id AND rp.permission_key = ${param})
  OR EXISTS (SELECT 1 FROM user_permissions up WHERE up.user_id = u.id AND up.permission_key = ${param})
)`;

export class UsersRepository implements IUsersRepository {
  private repository: Repository<User>;

  constructor() {
    this.repository = AppDataSource.getRepository(User);
  }

  async create({ roleIds, ...data }: ICreateUserDTO): Promise<User> {
    const { id } = await this.repository.save(
      this.repository.create({ ...data, roles: roleIds.map((roleId) => ({ id: roleId })), team: data.team ?? null, passwordChangedAt: new Date() }),
    );
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

  async list({ roleId, search, active }: IListUsersFilter): Promise<User[]> {
    const base: FindOptionsWhere<User> = {};
    // Filtrar pela relação limitaria as roles carregadas; por isso filtra pelos ids antes.
    if (roleId) {
      const rows = (await AppDataSource.query(`SELECT user_id FROM user_roles WHERE role_id = $1`, [roleId])) as { user_id: string }[];
      base.id = In(rows.map((r) => r.user_id));
    }
    if (active !== undefined) base.active = active;
    const where = search ? [{ ...base, name: ILike(`%${search}%`) }, { ...base, email: ILike(`%${search}%`) }] : base;
    return this.repository.find({ where, relations, order: { name: "ASC" } });
  }

  async setAccess(userId: string, { roleIds, permissions, team }: IUserAccess, grantedById: string): Promise<User> {
    await AppDataSource.transaction(async (tx) => {
      await tx.query(`DELETE FROM user_roles WHERE user_id = $1`, [userId]);
      for (const roleId of roleIds) {
        await tx.query(`INSERT INTO user_roles (user_id, role_id, granted_by_id) VALUES ($1, $2, $3)`, [userId, roleId, grantedById]);
      }
      await tx.delete(UserPermission, { userId });
      if (permissions.length) {
        await tx.insert(
          UserPermission,
          permissions.map((permissionKey) => ({ userId, permissionKey, grantedById })),
        );
      }
      await tx.update(User, userId, { team });
    });
    return (await this.findById(userId))!;
  }

  async countActiveWithPermission(permission: Permission): Promise<number> {
    const [row] = (await AppDataSource.query(`SELECT COUNT(*)::int AS count FROM users u WHERE u.active AND ${HAS_PERMISSION_SQL("$1")}`, [
      permission,
    ])) as { count: number }[];
    return row!.count;
  }
}
