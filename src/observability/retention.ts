import { asc, count, inArray, lt } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { getObservabilityConfig } from "./config";
import { observabilityEvents } from "./database/schema";
import { inProcessJobsEnabled } from "@/shared/in-process-jobs";

// Expurgo automático do log operacional — nunca toca security_audit_events (auditoria não
// expurga, ver audit-log.ts). Dois limites independentes, ambos pedidos explicitamente:
// por período (retentionDays) e por volume (maxEventVolume), para um pico de eventos num único
// dia não conseguir lotar a tabela mesmo dentro da janela de retenção.
export async function pruneEventsByRetention(now: Date = new Date()): Promise<number> {
  const { retentionDays } = getObservabilityConfig();
  const cutoff = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);

  const result = await db.delete(observabilityEvents).where(lt(observabilityEvents.occurredAt, cutoff));
  return result.rowCount ?? 0;
}

export async function pruneEventsByVolume(): Promise<number> {
  const { maxEventVolume } = getObservabilityConfig();

  const [{ value: total } = { value: 0 }] = await db.select({ value: count() }).from(observabilityEvents);
  const excess = total - maxEventVolume;
  if (excess <= 0) return 0;

  const oldestExcessRows = await db
    .select({ id: observabilityEvents.id })
    .from(observabilityEvents)
    .orderBy(asc(observabilityEvents.occurredAt))
    .limit(excess);

  if (oldestExcessRows.length === 0) return 0;

  const ids = oldestExcessRows.map((row) => row.id);
  const result = await db.delete(observabilityEvents).where(inArray(observabilityEvents.id, ids));
  return result.rowCount ?? 0;
}

export async function runRetentionSweep(): Promise<{ prunedByRetention: number; prunedByVolume: number }> {
  const prunedByRetention = await pruneEventsByRetention();
  const prunedByVolume = await pruneEventsByVolume();
  if (prunedByRetention > 0 || prunedByVolume > 0) {
    console.info(
      `[observability] retention sweep: ${prunedByRetention} por período, ${prunedByVolume} por volume`,
    );
  }
  return { prunedByRetention, prunedByVolume };
}

declare global {
  var __observabilityRetentionTimer: ReturnType<typeof setInterval> | undefined;
}

// Mesmo padrão do flush scheduler (flush.ts) — setInterval em processo, dedupe via global pra
// sobreviver a hot-reload em dev. Assume processo long-lived (decisão confirmada com o usuário
// na FASE 1); se o deploy for serverless-only, este scheduler não substitui um cron externo.
export function startRetentionScheduler(): void {
  if (globalThis.__observabilityRetentionTimer) return;

  const { retentionIntervalMs } = getObservabilityConfig();
  const timer = setInterval(() => {
    void runRetentionSweep();
  }, retentionIntervalMs);
  timer.unref?.();
  globalThis.__observabilityRetentionTimer = timer;
}

export function stopRetentionScheduler(): void {
  if (globalThis.__observabilityRetentionTimer) {
    clearInterval(globalThis.__observabilityRetentionTimer);
    globalThis.__observabilityRetentionTimer = undefined;
  }
}

if (inProcessJobsEnabled()) {
  startRetentionScheduler();
}
