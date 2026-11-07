import type { SupportTeam, UserRole } from "./UserRole";

export interface ICreateUserDTO {
  name: string;
  email: string;
  /** Senha já criptografada (o use case cuida do hash). */
  password: string;
  role: UserRole;
  department: string;
  team?: SupportTeam | null;
}

export interface IUpdateUserDTO {
  name?: string;
  role?: UserRole;
  department?: string;
  team?: SupportTeam | null;
  active?: boolean;
  password?: string;
}
