import { waitUntil } from "@vercel/functions";
import { db } from "@/infrastructure/database/client";
import { drainEvents, drainTraceEntries } from "./buffer";
import { getObservabilityConfig } from "./config";
import { observabilityEvents, observabilityTraceEntries } from "./database/schema";
import { inProcessJobsEnabled } from "@/shared/in-process-jobs";

export async function flushNow(): Promise<void> {
  const events = drainEvents();
  const traceEntries = drainTraceEntries();

  if (events.length > 0) {
    try {
      await db.insert(observabilityEvents).values(events);
    } catch (error) {
      console.error("[observability] failed to flush events", error);
    }
  }

  if (traceEntries.length > 0) {
    try {
      await db.insert(observabilityTraceEntries).values(traceEntries);
    } catch (error) {
      console.error("[observability] failed to flush trace entries", error);
    }
  }
}

// Serverless (Vercel): o timer em processo quase nunca dispara antes da função congelar, e o
// buffer se perdia. Aqui o flush é agendado pra DEPOIS da resposta com waitUntil (a função fica
// viva até terminar) — um lote por request, não um INSERT por log (AGENTS.md §2).
let flushScheduled = false;

export function scheduleFlushAfterResponse(): void {
  if (!process.env.VERCEL || flushScheduled) return;
  flushScheduled = true;
  const pending = new Promise<void>((resolve) => setTimeout(resolve, 0))
    .then(() => flushNow())
    .finally(() => {
      flushScheduled = false;
    });
  waitUntil(pending);
}

declare global {
  var __observabilityFlushTimer: ReturnType<typeof setInterval> | undefined;
}

export function startFlushScheduler(): void {
  if (globalThis.__observabilityFlushTimer) return;

  const { flushIntervalMs } = getObservabilityConfig();
  const timer = setInterval(() => {
    void flushNow();
  }, flushIntervalMs);
  timer.unref?.();
  globalThis.__observabilityFlushTimer = timer;
}

export function stopFlushScheduler(): void {
  if (globalThis.__observabilityFlushTimer) {
    clearInterval(globalThis.__observabilityFlushTimer);
    globalThis.__observabilityFlushTimer = undefined;
  }
}

if (inProcessJobsEnabled()) {
  startFlushScheduler();
}
