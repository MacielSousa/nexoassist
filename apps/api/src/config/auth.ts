import { env } from "./env";

export const authConfig = {
  secret: env.JWT_SECRET,
  /** Token de acesso curto; o front renova com o refresh token. */
  expiresIn: env.JWT_EXPIRES_IN,
  refreshTokenDays: env.REFRESH_TOKEN_DAYS,
};
