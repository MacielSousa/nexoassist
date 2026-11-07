import { Router } from "express";
import { filesRoutes } from "./files.routes";
import { reportsRoutes } from "./reports.routes";
import { permissionsRoutes, rolesRoutes } from "./roles.routes";
import { sessionsRoutes } from "./sessions.routes";
import { consoleRoutes, conversationsRoutes, draftsRoutes } from "./support.routes";
import { articlesRoutes, ticketsRoutes } from "./tickets.routes";
import { usersRoutes } from "./users.routes";

export const router = Router();

router.use("/sessions", sessionsRoutes);
router.use("/users", usersRoutes);
router.use("/roles", rolesRoutes);
router.use("/permissions", permissionsRoutes);
router.use("/tickets", ticketsRoutes);
router.use("/articles", articlesRoutes);
router.use("/conversations", conversationsRoutes);
router.use("/drafts", draftsRoutes);
router.use("/console", consoleRoutes);
router.use("/reports", reportsRoutes);
router.use("/files", filesRoutes);
