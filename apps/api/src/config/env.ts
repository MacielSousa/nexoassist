import { z } from "zod";

// Variáveis de ambiente validadas na inicialização: se faltar algo, a API não sobe
// com um erro confuso lá na frente, e sim com uma mensagem clara aqui.

const bool = z.enum(["true", "false"]).transform((v) => v === "true");

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(3333),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),

  DB_HOST: z.string().default("localhost"),
  DB_PORT: z.coerce.number().default(5432),
  DB_USER: z.string().default("nexo"),
  DB_PASSWORD: z.string().default("nexo"),
  DB_NAME: z.string().default("nexo"),
  DB_LOGGING: bool.default(false),

  JWT_SECRET: z.string().min(32, "JWT_SECRET precisa ter ao menos 32 caracteres"),
  JWT_EXPIRES_IN: z.string().default("15m"),
  REFRESH_TOKEN_DAYS: z.coerce.number().default(30),

  NEXO_MODEL: z.string().default("anthropic/claude-haiku-5-5"),

  // Simulação do sistema legado de chamados (ver modules/tickets/providers).
  SERVICE_DESK_FAILURE_RATE: z.coerce.number().min(0).max(1).default(0.05),
  SERVICE_DESK_OUTAGE: z.enum(["on", "off"]).default("on"),
  SERVICE_DESK_OUTAGE_PERIOD: z.coerce.number().default(240),
  SERVICE_DESK_OUTAGE_SECONDS: z.coerce.number().default(5),
});

const testDefaults = { JWT_SECRET: "test-secret-test-secret-test-secret-0000", DB_NAME: "nexo_test" };

const parsed = schema.safeParse(process.env.NODE_ENV === "test" ? { ...testDefaults, ...process.env } : process.env);
if (!parsed.success) {
  console.error("Variáveis de ambiente inválidas:\n" + z.prettifyError(parsed.error));
  process.exit(1);
}

export const env = parsed.data;
