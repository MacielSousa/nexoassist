import { Router } from "express";
import { z } from "zod";
import { UserResponseSchema } from "@modules/accounts/mapper/UserMap";
import { CreateUserController } from "@modules/accounts/useCases/createUser/CreateUserController";
import { ListUsersController } from "@modules/accounts/useCases/listUsers/ListUsersController";
import { ProfileUserController } from "@modules/accounts/useCases/profileUser/ProfileUserController";
import { UpdateUserController } from "@modules/accounts/useCases/updateUser/UpdateUserController";
import { FilesController } from "@modules/files/useCases/FilesController";
import { defineRoute } from "../defineRoute";
import { passwordCheckLimiter } from "../middlewares/rateLimiter";
import { uploadSingleFile } from "../middlewares/uploadSingleFile";

export const usersRoutes = Router();

const profile = new ProfileUserController();

defineRoute(usersRoutes, "/users", {
  method: "get",
  path: "/me",
  tag: "Perfil",
  summary: "Dados do usuário autenticado",
  auth: "any",
  responses: { 200: { description: "Usuário", schema: UserResponseSchema } },
  handler: profile.show,
});

defineRoute(usersRoutes, "/users", {
  method: "patch",
  path: "/me",
  tag: "Perfil",
  summary: "Editar o próprio perfil (nome, área e e-mail)",
  description: "Trocar o e-mail exige a senha atual (currentPassword) e encerra as outras sessões.",
  auth: "any",
  request: { body: ProfileUserController.updateProfileBody },
  middlewares: [passwordCheckLimiter],
  responses: { 200: { description: "Usuário atualizado", schema: UserResponseSchema } },
  handler: profile.update,
});

defineRoute(usersRoutes, "/users", {
  method: "put",
  path: "/me/avatar",
  tag: "Perfil",
  summary: "Enviar a própria foto de perfil",
  description: "Imagem JPG, PNG, WEBP ou GIF, até 5 MB.",
  auth: "any",
  request: { body: FilesController.uploadBody },
  bodyContentType: "multipart/form-data",
  middlewares: [uploadSingleFile],
  responses: { 200: { description: "Usuário com a nova foto", schema: UserResponseSchema } },
  handler: profile.updateAvatar,
});

defineRoute(usersRoutes, "/users", {
  method: "delete",
  path: "/me/avatar",
  tag: "Perfil",
  summary: "Remover a própria foto de perfil",
  auth: "any",
  responses: { 200: { description: "Usuário sem foto", schema: UserResponseSchema } },
  handler: profile.removeAvatar,
});

defineRoute(usersRoutes, "/users", {
  method: "patch",
  path: "/me/password",
  tag: "Perfil",
  summary: "Trocar a própria senha",
  description: "Encerra as outras sessões abertas.",
  auth: "any",
  request: { body: ProfileUserController.changePasswordBody },
  middlewares: [passwordCheckLimiter],
  responses: { 204: { description: "Senha alterada" } },
  handler: profile.changePassword,
});

defineRoute(usersRoutes, "/users", {
  method: "get",
  path: "/",
  tag: "Usuários",
  summary: "Listar usuários",
  auth: ["users.view", "users.manage"],
  request: { query: ListUsersController.query },
  responses: { 200: { description: "Usuários", schema: z.array(UserResponseSchema) } },
  handler: new ListUsersController().handle,
});

defineRoute(usersRoutes, "/users", {
  method: "post",
  path: "/",
  tag: "Usuários",
  summary: "Cadastrar funcionário, analista ou admin",
  auth: ["users.manage"],
  request: { body: CreateUserController.body },
  responses: { 201: { description: "Usuário criado", schema: UserResponseSchema } },
  handler: new CreateUserController().handle,
});

defineRoute(usersRoutes, "/users", {
  method: "patch",
  path: "/:id",
  tag: "Usuários",
  summary: "Editar, ativar/desativar ou redefinir a senha de um usuário",
  auth: ["users.manage"],
  request: { params: UpdateUserController.params, body: UpdateUserController.body },
  responses: { 200: { description: "Usuário atualizado", schema: UserResponseSchema } },
  handler: new UpdateUserController().handle,
});

defineRoute(usersRoutes, "/users", {
  method: "put",
  path: "/:id/avatar",
  tag: "Usuários",
  summary: "Trocar a foto de perfil de um usuário",
  auth: ["users.manage"],
  request: { params: ProfileUserController.userParams, body: FilesController.uploadBody },
  bodyContentType: "multipart/form-data",
  middlewares: [uploadSingleFile],
  responses: { 200: { description: "Usuário com a nova foto", schema: UserResponseSchema } },
  handler: profile.updateAvatar,
});

defineRoute(usersRoutes, "/users", {
  method: "delete",
  path: "/:id/avatar",
  tag: "Usuários",
  summary: "Remover a foto de perfil de um usuário",
  auth: ["users.manage"],
  request: { params: ProfileUserController.userParams },
  responses: { 200: { description: "Usuário sem foto", schema: UserResponseSchema } },
  handler: profile.removeAvatar,
});

defineRoute(usersRoutes, "/users", {
  method: "put",
  path: "/:id/access",
  tag: "Usuários",
  summary: "Definir o acesso de um usuário: roles (macro) e permissões diretas (micro)",
  description:
    "As listas enviadas substituem as atuais. Só é possível conceder (por role ou direto) o que você mesmo tem, " +
    "salvo quem tem roles.manage. Ninguém altera o próprio acesso, e o sistema nunca fica sem administradores.",
  auth: ["users.manage"],
  request: { params: UpdateUserController.params, body: UpdateUserController.accessBody },
  responses: { 200: { description: "Usuário atualizado", schema: UserResponseSchema } },
  handler: new UpdateUserController().setAccess,
});
