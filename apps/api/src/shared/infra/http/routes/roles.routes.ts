import { Router } from "express";
import { z } from "zod";
import { RolesController } from "@modules/accounts/useCases/roles/RolesController";
import { PermissionResponseSchema, RoleResponseSchema } from "@modules/accounts/useCases/roles/RolesUseCases";
import { defineRoute } from "../defineRoute";

export const rolesRoutes = Router();
export const permissionsRoutes = Router();
const roles = new RolesController();

defineRoute(permissionsRoutes, "/permissions", {
  method: "get",
  path: "/",
  tag: "Roles e permissões",
  summary: "Catálogo de permissões",
  auth: ["roles.manage", "users.manage"],
  responses: { 200: { description: "Permissões disponíveis", schema: z.array(PermissionResponseSchema) } },
  handler: roles.permissions,
});

defineRoute(rolesRoutes, "/roles", {
  method: "get",
  path: "/",
  tag: "Roles e permissões",
  summary: "Listar roles (com permissões e quantidade de usuários)",
  auth: ["roles.manage", "users.view", "users.manage"],
  responses: { 200: { description: "Roles", schema: z.array(RoleResponseSchema) } },
  handler: roles.list,
});

defineRoute(rolesRoutes, "/roles", {
  method: "post",
  path: "/",
  tag: "Roles e permissões",
  summary: "Criar role",
  description: "Só é possível incluir permissões que você mesmo tem.",
  auth: ["roles.manage"],
  request: { body: RolesController.body },
  responses: { 201: { description: "Role criada", schema: RoleResponseSchema } },
  handler: roles.create,
});

defineRoute(rolesRoutes, "/roles", {
  method: "patch",
  path: "/:id",
  tag: "Roles e permissões",
  summary: "Editar role (nome, descrição, permissões)",
  description: "Recusa mudanças que deixariam o sistema sem ninguém para gerenciar usuários e roles.",
  auth: ["roles.manage"],
  request: { params: RolesController.params, body: RolesController.updateBody },
  responses: { 200: { description: "Role atualizada", schema: RoleResponseSchema } },
  handler: roles.update,
});

defineRoute(rolesRoutes, "/roles", {
  method: "delete",
  path: "/:id",
  tag: "Roles e permissões",
  summary: "Excluir role",
  description: "Roles de sistema e roles com usuários não podem ser excluídas.",
  auth: ["roles.manage"],
  request: { params: RolesController.params },
  responses: { 204: { description: "Role excluída" } },
  handler: roles.delete,
});
