import { join } from "node:path";
import { dataDir } from "@/data-dir";
import { ServiceDeskRepository } from "./repository";
import type { ServiceDeskOptions } from "./http";

export { handleServiceDesk, type ServiceDeskOptions } from "./http";
export { ServiceDeskRepository } from "./repository";

const g = globalThis as unknown as { __serviceDesk?: ServiceDeskOptions };

function num(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return value !== undefined && value !== "" && Number.isFinite(n) ? n : fallback;
}

/** Instância única por processo (sobrevive ao hot reload do Next em dev). */
export function serviceDeskOptions(): ServiceDeskOptions {
  g.__serviceDesk ??= {
    repo: new ServiceDeskRepository(process.env.SERVICE_DESK_DB ?? join(dataDir(), "service-desk.db")),
    token: process.env.SERVICE_DESK_TOKEN ?? "dev-service-token",
    chaos: {
      failureRate: num(process.env.SERVICE_DESK_FAILURE_RATE, 0.05),
      outage:
        process.env.SERVICE_DESK_OUTAGE === "off"
          ? null
          : { periodSec: num(process.env.SERVICE_DESK_OUTAGE_PERIOD, 240), downSec: num(process.env.SERVICE_DESK_OUTAGE_SECONDS, 5) },
      latencyMs: [80, 350],
    },
  };
  return g.__serviceDesk;
}
