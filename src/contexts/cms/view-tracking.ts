import { waitUntil } from "@vercel/functions";
import { eq, sql } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { entries } from "./database/schema";
import { inProcessJobsEnabled } from "@/shared/in-process-jobs";

// Contador de acesso por conteúdo (Fase 3/C9 — docs/implementation-roadmap.md). Mesmo raciocínio
// do buffer de log em observability/buffer.ts+flush.ts (AGENTS.md §2 — "log síncrono por
// chamada" é o padrão PROIBIDO): uma visita pública nunca gera um UPDATE imediato; acumula em
// memória e uma varredura periódica grava em lote. `Map<entryId, incremento>` porque múltiplas
// visitas à MESMA entry entre dois flushes devem virar um único `+= N`, não N updates.
let pendingViews = new Map<string, number>();

// Chamado pelas rotas públicas ([...slug]/page.tsx e (platform)/page.tsx) depois que a entry já
// passou pelo gate de visibilidade (Fase 2/C7) — só visita que efetivamente renderizou conta.
export function recordEntryView(entryId: string): void {
  pendingViews.set(entryId, (pendingViews.get(entryId) ?? 0) + 1);
  scheduleViewFlushAfterResponse();
}

// Serverless: flush agendado pra depois da resposta (waitUntil) — o contador em memória se
// perdia quando a função congelava antes do timer. Self-host segue no timer em processo.
let viewFlushScheduled = false;
function scheduleViewFlushAfterResponse(): void {
  if (!process.env.VERCEL || viewFlushScheduled) return;
  viewFlushScheduled = true;
  const pending = new Promise<void>((resolve) => setTimeout(resolve, 0))
    .then(() => flushEntryViews())
    .then(() => undefined)
    .finally(() => {
      viewFlushScheduled = false;
    });
  waitUntil(pending);
}

export async function flushEntryViews(): Promise<number> {
  if (pendingViews.size === 0) return 0;

  const drained = pendingViews;
  pendingViews = new Map();

  for (const [entryId, increment] of drained) {
    await db
      .update(entries)
      .set({ viewCount: sql`${entries.viewCount} + ${increment}` })
      .where(eq(entries.id, entryId));
  }

  return drained.size;
}

declare global {
  var __cmsViewFlushTimer: ReturnType<typeof setInterval> | undefined;
}

const CMS_VIEW_FLUSH_INTERVAL_MS = 30_000;

// Mesmo padrão de observability/flush.ts e cms/scheduling.ts: setInterval em processo, dedupe via
// global pra sobreviver a hot-reload em dev. Mesma ressalva já aceita nos outros dois: assume
// processo long-lived — contadores em memória de um processo serverless de vida curta se perdem
// antes do próximo flush; ver docs/implementation-roadmap.md pra essa limitação já registrada.
export function startEntryViewFlushScheduler(): void {
  if (globalThis.__cmsViewFlushTimer) return;

  const timer = setInterval(() => {
    void flushEntryViews();
  }, CMS_VIEW_FLUSH_INTERVAL_MS);
  timer.unref?.();
  globalThis.__cmsViewFlushTimer = timer;
}

export function stopEntryViewFlushScheduler(): void {
  if (globalThis.__cmsViewFlushTimer) {
    clearInterval(globalThis.__cmsViewFlushTimer);
    globalThis.__cmsViewFlushTimer = undefined;
  }
}

if (inProcessJobsEnabled()) {
  startEntryViewFlushScheduler();
}
