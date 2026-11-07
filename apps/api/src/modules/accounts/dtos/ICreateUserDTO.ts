import type { SupportTeam } from "./UserRole";

export interface ICreateUserDTO {
  name: string;
  email: string;
  /** Senha já criptografada (o use case cuida do hash). */
  password: string;
  /** Uma ou mais roles. */
  roleIds: string[];
  department: string;
  team?: SupportTeam | null;
}

export interface IUpdateUserDTO {
  name?: string;
  email?: string;
  avatarFileId?: string | null;
  department?: string;
  team?: SupportTeam | null;
  active?: boolean;
  password?: string;
}
