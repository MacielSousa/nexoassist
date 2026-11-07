import { z } from "zod";
import { SUPPORT_TEAMS, USER_ROLES } from "../dtos/UserRole";
import type { User } from "../infra/typeorm/entities/User";

/** Formato público do usuário: o que a API devolve (sem senha). */
export const UserResponseSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    email: z.email(),
    role: z.enum(USER_ROLES),
    department: z.string(),
    team: z.enum(SUPPORT_TEAMS).nullable(),
    active: z.boolean(),
    initials: z.string(),
    passwordChangedAt: z.iso.datetime(),
    createdAt: z.iso.datetime(),
  })
  .meta({ id: "User" });

export type IUserResponseDTO = z.infer<typeof UserResponseSchema>;

export const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

export class UserMap {
  static toDTO(user: User): IUserResponseDTO {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
      team: user.team,
      active: user.active,
      initials: initialsOf(user.name),
      passwordChangedAt: user.passwordChangedAt.toISOString(),
      createdAt: user.createdAt.toISOString(),
    };
  }
}
