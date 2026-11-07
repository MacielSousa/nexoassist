import { inject, injectable } from "tsyringe";
import { z } from "zod";
import type { IActor } from "@modules/accounts/dtos/IActor";
import { PERMISSION_KEYS, type Permission } from "@modules/accounts/dtos/permissions";
import type { Role } from "@modules/accounts/infra/typeorm/entities/Role";
import type { IRolesRepository } from "@modules/accounts/repositories/IRolesRepository";
import type { IUsersRepository } from "@modules/accounts/repositories/IUsersRepository";
import { AccessGuard } from "@modules/accounts/services/AccessGuard";
import { AppError } from "@shared/errors/AppError";

export const RoleResponseSchema = z
  .object({
    id: z.uuid(),
    key: z.string(),
    name: z.string(),
    description: z.string(),
    isSystem: z.boolean().meta({ description: "Roles de sistema não podem ser excluídas" }),
    permissions: z.array(z.enum(PERMISSION_KEYS)),
    userCount: z.number().optional(),
  })
  .meta({ id: "Role" });
export type IRoleResponseDTO = z.infer<typeof RoleResponseSchema>;

export const PermissionResponseSchema = z.object({ key: z.enum(PERMISSION_KEYS), group: z.string(), description: z.string() }).meta({ id: "Permission" });

const toDTO = (role: Role & { userCount?: number }): IRoleResponseDTO => ({
  id: role.id,
  key: role.key,
  name: role.name,
  description: role.description,
  isSystem: role.isSystem,
  permissions: role.permissions.map((p) => p.key as Permission),
  userCount: role.userCount,
});

/** "Suporte N3 — Redes" → "suporte-n3-redes" */
const slugify = (name: string) =>
  name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);

/**
 * Cadastro de roles (quem tem roles.manage). Uma role é um nome + um conjunto de permissões.
 * Roles de sistema podem ter as permissões ajustadas, mas não podem ser excluídas.
 */
@injectable()
export class RolesUseCases {
  constructor(
    @inject("RolesRepository") private roles: IRolesRepository,
    @inject("UsersRepository") private users: IUsersRepository,
  ) {}

  async list(): Promise<IRoleResponseDTO[]> {
    return (await this.roles.list()).map(toDTO);
  }

  async listPermissions() {
    return (await this.roles.listPermissions()).map((p) => ({ key: p.key as Permission, group: p.group, description: p.description }));
  }

  async create({ actor, name, description, permissions }: { actor: IActor; name: string; description: string; permissions: Permission[] }) {
    AccessGuard.ensureCanGrant(actor, permissions);
    const key = slugify(name);
    if (!key) throw new AppError("Nome inválido.", 422);
    if ((await this.roles.findByName(name.trim())) || (await this.roles.findByKey(key))) throw new AppError("Já existe uma role com esse nome.", 409);
    return toDTO(await this.roles.create({ key, name: name.trim(), description: description.trim(), permissions: [...new Set(permissions)] }));
  }

  async update({ actor, id, name, description, permissions }: { actor: IActor; id: string; name?: string; description?: string; permissions?: Permission[] }) {
    const role = await this.roles.findById(id);
    if (!role) throw new AppError("Role não encontrada.", 404);
    const before = role.permissions.map((p) => p.key as Permission);
    if (permissions) AccessGuard.ensureCanGrant(actor, permissions.filter((p) => !before.includes(p)));
    if (name && name.trim() !== role.name) {
      const clash = await this.roles.findByName(name.trim());
      if (clash && clash.id !== id) throw new AppError("Já existe uma role com esse nome.", 409);
    }

    const updated = await this.roles.update(id, { name: name?.trim(), description: description?.trim(), permissions: permissions && [...new Set(permissions)] });
    // Tirar permissões de uma role pode deixar o sistema sem administradores: desfaz.
    try {
      await AccessGuard.ensureAdminsRemain(this.users);
    } catch (err) {
      await this.roles.update(id, { permissions: before });
      throw err;
    }
    return toDTO(updated);
  }

  async delete(id: string) {
    const role = await this.roles.findById(id);
    if (!role) throw new AppError("Role não encontrada.", 404);
    if (role.isSystem) throw new AppError("Roles de sistema não podem ser excluídas.", 409);
    const count = await this.roles.countUsers(id);
    if (count > 0) throw new AppError(`Há ${count} usuário(s) com essa role. Retire a role deles antes de excluir.`, 409);
    await this.roles.delete(id);
  }
}
