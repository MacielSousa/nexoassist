import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const src = (path: string) => fileURLToPath(new URL(`./src/${path}`, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@config": src("config"),
      "@modules": src("modules"),
      "@shared": src("shared"),
    },
  },
  test: {
    include: ["src/**/*.spec.ts"],
    environment: "node",
    setupFiles: ["reflect-metadata"],
  },
});
