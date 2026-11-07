import { Router } from "express";
import { sessionsRoutes } from "./sessions.routes";
import { consoleRoutes, conversationsRoutes, draftsRoutes } from "./support.routes";
import { articlesRoutes, ticketsRoutes } from "./tickets.routes";
import { usersRoutes } from "./users.routes";

export const router = Router();

router.use("/sessions", sessionsRoutes);
router.use("/users", usersRoutes);
router.use("/tickets", ticketsRoutes);
router.use("/articles", articlesRoutes);
router.use("/conversations", conversationsRoutes);
router.use("/drafts", draftsRoutes);
router.use("/console", consoleRoutes);
