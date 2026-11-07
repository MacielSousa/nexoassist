import { Router } from "express";
import { AuthenticateUserController } from "@modules/accounts/useCases/authenticateUser/AuthenticateUserController";
import { RefreshTokenController } from "@modules/accounts/useCases/refreshToken/RefreshTokenController";
import { defineRoute } from "../defineRoute";

export const sessionsRoutes = Router();

const authenticate = new AuthenticateUserController();
const refresh = new RefreshTokenController();

defineRoute(sessionsRoutes, "/sessions", {
  method: "post",
  path: "/",
  tag: "Sessões",
  summary: "Entrar com e-mail e senha",
  auth: false,
  request: { body: AuthenticateUserController.body },
  responses: { 200: { description: "Tokens e dados do usuário", schema: AuthenticateUserController.response } },
  handler: authenticate.handle,
});

defineRoute(sessionsRoutes, "/sessions", {
  method: "post",
  path: "/refresh",
  tag: "Sessões",
  summary: "Renovar o token de acesso",
  description: "Troca o refresh token por um novo par. O refresh token antigo deixa de valer.",
  auth: false,
  request: { body: RefreshTokenController.body },
  responses: { 200: { description: "Novos tokens", schema: RefreshTokenController.response } },
  handler: refresh.handle,
});

defineRoute(sessionsRoutes, "/sessions", {
  method: "post",
  path: "/logout",
  tag: "Sessões",
  summary: "Sair (invalida o refresh token)",
  auth: false,
  request: { body: RefreshTokenController.body },
  responses: { 204: { description: "Sessão encerrada" } },
  handler: refresh.logout,
});
