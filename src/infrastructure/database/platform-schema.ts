import { index, integer, pgSchema, text, timestamp } from "drizzle-orm/pg-core";

// Schema "platform": estado de infraestrutura compartilhado entre instâncias do app (serverless ou
// várias réplicas) que não pertence a nenhum context de domínio.
export const platformSchema = pgSchema("platform");

// Janela fixa por chave. Uma linha por chave ativa; `expires_at` passado = janela nova no
// próximo hit. Linhas vencidas são apagadas pela varredura (deleteExpiredRateLimits).
export const rateLimits = platformSchema.table(
  "rate_limits",
  {
    key: text("key").primaryKey(),
    count: integer("count").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [index("rate_limits_expires_at_idx").on(table.expiresAt)],
);

// Uma linha por tarefa agendada (platform/scheduled-jobs). `locked_until` impede duas instâncias
// (ou duas batidas do cron) de rodarem a mesma tarefa ao mesmo tempo; `last_started_at` decide se
// já passou o intervalo desde a última execução.
export const scheduledJobRuns = platformSchema.table("scheduled_job_runs", {
  key: text("key").primaryKey(),
  lastStartedAt: timestamp("last_started_at", { withTimezone: true }),
  lastFinishedAt: timestamp("last_finished_at", { withTimezone: true }),
  lastStatus: text("last_status"),
  lastError: text("last_error"),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
});
