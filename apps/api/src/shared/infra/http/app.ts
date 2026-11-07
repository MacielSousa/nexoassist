import "reflect-metadata";
import cors from "cors";
import express from "express";
import swaggerUi from "swagger-ui-express";
import { env } from "@config/env";
import "@shared/container";
import { openApiDocument } from "./docs/openapi";
import { errorHandler } from "./middlewares/errorHandler";
import { rateLimiter } from "./middlewares/rateLimiter";
import { router } from "./routes";

export const app = express();

app.set("trust proxy", 1);
app.disable("x-powered-by");

app.get("/health", (_request, response) => {
  response.json({ status: "ok" });
});

app.use(cors({ origin: env.CORS_ORIGIN.split(","), credentials: true }));
app.use(express.json({ limit: "100kb" }));
if (env.NODE_ENV !== "test") app.use(rateLimiter({ windowMs: 60_000, max: 300 }));

app.use(router);

// Documentação: Swagger UI em /api-docs e o JSON em /api-docs.json.
const document = openApiDocument();
app.get("/api-docs.json", (_request, response) => {
  response.json(document);
});
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(document, { customSiteTitle: "Nexo Assist API" }));

app.use(errorHandler);
