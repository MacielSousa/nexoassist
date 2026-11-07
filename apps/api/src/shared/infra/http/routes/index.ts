import { Router } from "express";
import { sessionsRoutes } from "./sessions.routes";
import { usersRoutes } from "./users.routes";

export const router = Router();

router.use("/sessions", sessionsRoutes);
router.use("/users", usersRoutes);
