import { sql } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";

export type HealthReport = { status: "ok" | "degraded"; checks: { database: "ok" | "fail" }; version: string | null };

const DB_TIMEOUT_MS = 2_000;

// Sonda de saúde pra monitor externo (UptimeRobot, Better Stack, load balancer). Só diz se o app
// responde e alcança o banco — nada de detalhe de erro, host ou configuração (a rota é pública).
export async function checkHealth(): Promise<HealthReport> {
  const database = await Promise.race([
    db.execute(sql`select 1`).then(() => "ok" as const),
    new Promise<"fail">((resolve) => setTimeout(() => resolve("fail"), DB_TIMEOUT_MS)),
  ]).catch(() => "fail" as const);

  return {
    status: database === "ok" ? "ok" : "degraded",
    checks: { database },
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? process.env.npm_package_version ?? null,
  };
}
