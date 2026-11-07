import { In, type Repository } from "typeorm";
import type { IRolesRepository, ISaveRoleDTO } from "@modules/accounts/repositories/IRolesRepository";
import { AppDataSource } from "@shared/infra/typeorm/data-source";
import { Permission } from "../entities/Permission";
import { Role } from "../entities/Role";

export class RolesRepository implements IRolesRepository {
  private repository: Repository<Role>;
  private permissions: Repository<Permission>;

  constructor() {
    this.repository = AppDataSource.getRepository(Role);
    this.permissions = AppDataSource.getRepository(Permission);
  }

  async list() {
    const roles = await this.repository.find({ relations: { permissions: true }, order: { isSystem: "DESC", name: "ASC" } });
    const counts = (await AppDataSource.query(`SELECT role_id, COUNT(*)::int AS n FROM user_roles GROUP BY role_id`)) as { role_id: string; n: number }[];
    const byRole = new Map(counts.map((c) => [c.role_id, c.n]));
    return roles.map((r) => Object.assign(r, { userCount: byRole.get(r.id) ?? 0 }));
  }

  findById(id: string) {
    return this.repository.findOne({ where: { id }, relations: { permissions: true } });
  }

  findByKey(key: string) {
    return this.repository.findOne({ where: { key }, relations: { permissions: true } });
  }

  findByName(name: string) {
    return this.repository.findOne({ where: { name }, relations: { permissions: true } });
  }

  async create(data: ISaveRoleDTO) {
    const permissions = await this.permissions.findBy({ key: In(data.permissions) });
    const { id } = await this.repository.save(this.repository.create({ ...data, permissions, isSystem: false }));
    return (await this.findById(id))!;
  }

  async update(id: string, data: Partial<ISaveRoleDTO>) {
    const role = (await this.findById(id))!;
    if (data.name !== undefined) role.name = data.name;
    if (data.description !== undefined) role.description = data.description;
    if (data.permissions) role.permissions = await this.permissions.findBy({ key: In(data.permissions) });
    await this.repository.save(role);
    return (await this.findById(id))!;
  }

  async delete(id: string) {
    await this.repository.delete(id);
  }

  async countUsers(roleId: string) {
    const [row] = (await AppDataSource.query(`SELECT COUNT(*)::int AS n FROM user_roles WHERE role_id = $1`, [roleId])) as { n: number }[];
    return row!.n;
  }

  listPermissions() {
    return this.permissions.find({ order: { group: "ASC", key: "ASC" } });
  }
}
