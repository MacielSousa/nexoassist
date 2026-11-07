import type { SupportTeam } from "./UserRole";

export interface ICreateUserDTO {
  name: string;
  email: string;
  /** Senha já criptografada (o use case cuida do hash). */
  password: string;
  roleId: string;
  department: string;
  team?: SupportTeam | null;
}

export interface IUpdateUserDTO {
  name?: string;
  email?: string;
  avatarFileId?: string | null;
  roleId?: string;
  department?: string;
  team?: SupportTeam | null;
  active?: boolean;
  password?: string;
}
