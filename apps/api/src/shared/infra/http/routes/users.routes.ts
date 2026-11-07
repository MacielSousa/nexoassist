import { Router } from "express";
import { z } from "zod";
import { UserResponseSchema } from "@modules/accounts/mapper/UserMap";
import { CreateUserController } from "@modules/accounts/useCases/createUser/CreateUserController";
import { ListUsersController } from "@modules/accounts/useCases/listUsers/ListUsersController";
import { ProfileUserController } from "@modules/accounts/useCases/profileUser/ProfileUserController";
import { UpdateUserController } from "@modules/accounts/useCases/updateUser/UpdateUserController";
import { defineRoute } from "../defineRoute";

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
  path: "/me/password",
  tag: "Perfil",
  summary: "Trocar a própria senha",
  description: "Encerra as outras sessões abertas.",
  auth: "any",
  request: { body: ProfileUserController.changePasswordBody },
  responses: { 204: { description: "Senha alterada" } },
  handler: profile.changePassword,
});

defineRoute(usersRoutes, "/users", {
  method: "get",
  path: "/",
  tag: "Usuários",
  summary: "Listar usuários",
  auth: ["admin"],
  request: { query: ListUsersController.query },
  responses: { 200: { description: "Usuários", schema: z.array(UserResponseSchema) } },
  handler: new ListUsersController().handle,
});

defineRoute(usersRoutes, "/users", {
  method: "post",
  path: "/",
  tag: "Usuários",
  summary: "Cadastrar funcionário, analista ou admin",
  auth: ["admin"],
  request: { body: CreateUserController.body },
  responses: { 201: { description: "Usuário criado", schema: UserResponseSchema } },
  handler: new CreateUserController().handle,
});

defineRoute(usersRoutes, "/users", {
  method: "patch",
  path: "/:id",
  tag: "Usuários",
  summary: "Editar, ativar/desativar ou redefinir a senha de um usuário",
  auth: ["admin"],
  request: { params: UpdateUserController.params, body: UpdateUserController.body },
  responses: { 200: { description: "Usuário atualizado", schema: UserResponseSchema } },
  handler: new UpdateUserController().handle,
});
