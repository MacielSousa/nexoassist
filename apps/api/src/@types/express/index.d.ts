import type { IActor } from "@modules/accounts/dtos/IActor";

declare global {
  namespace Express {
    interface Request {
      /** Preenchido pelo middleware ensureAuthenticated (id + permissões efetivas). */
      user: IActor;
    }
  }
}

export {};
