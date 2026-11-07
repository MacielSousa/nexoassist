import type { UserRole } from "@modules/accounts/dtos/UserRole";

declare global {
  namespace Express {
    interface Request {
      /** Preenchido pelo middleware ensureAuthenticated. */
      user: { id: string; role: UserRole };
    }
  }
}

export {};
