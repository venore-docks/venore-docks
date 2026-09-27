import { and, eq, inArray, lte, or } from "drizzle-orm";
import { db } from "@/infrastructure/database/client";
import { invalidateCacheByPrefix } from "@/infrastructure/cache/memory-cache";
import { entries } from "./database/schema";
import { inProcessJobsEnabled } from "@/shared/in-process-jobs";

// Varredura de agendamento (Fase 2/C5 — docs/implementation-roadmap.md): transição automática
// scheduled -> published e (scheduled | published) -> archived, quando a data agendada já
// passou. Roda fora do fluxo handler/service/store de um use case actor-invocado de propósito —
// é um processo de sistema (relógio, não ator autenticado), mesmo raciocínio de
// observability/retention.ts: consulta/atualiza a tabela direto, sem authorizeActor.
//
// Simplificação aceita: a transição automática NÃO roda a validação de blocos não configurados
// que publish-entry roda numa publicação manual (essa validação recebe um `resolveDefinition` de
// platform/page-builder, e este módulo mora dentro de contexts/cms — importar platform/ daqui
// inverteria a hierarquia de dependência declarada em docs/venore-docks.md, regra 12). Uma entry
// agendada com bloco quebrado vai ao ar do mesmo jeito no horário marcado; publicar manualmente
// continua validando normalmente. Registrado como gap aceito, não "a resolver depois".
export async function processScheduledEntries(now: Date = new Date()): Promise<{ published: number; archived: number }> {
  const duePublish = await db
    .select({ id: entries.id })
    .from(entries)
    .where(and(eq(entries.status, "scheduled"), lte(entries.scheduledPublishAt, now)));

  if (duePublish.length > 0) {
    await db
      .update(entries)
      .set({ status: "published", scheduledPublishAt: null, publishedAt: now, updatedAt: now })
      .where(
        inArray(
          entries.id,
          duePublish.map((row) => row.id),
        ),
      );

    invalidateCacheByPrefix("cms:entries:published");
    invalidateCacheByPrefix("cms:navigation");
  }

  const dueArchive = await db
    .select({ id: entries.id })
    .from(entries)
    .where(
      and(
        or(eq(entries.status, "scheduled"), eq(entries.status, "published")),
        lte(entries.scheduledArchiveAt, now),
      ),
    );

  if (dueArchive.length > 0) {
    await db
      .update(entries)
      .set({ status: "archived", updatedAt: now })
      .where(
        inArray(
          entries.id,
          dueArchive.map((row) => row.id),
        ),
      );

    invalidateCacheByPrefix("cms:entries:published");
    invalidateCacheByPrefix("cms:navigation");
  }

  return { published: duePublish.length, archived: dueArchive.length };
}

declare global {
  var __cmsSchedulingTimer: ReturnType<typeof setInterval> | undefined;
}

const CMS_SCHEDULING_INTERVAL_MS = 60_000;

// Mesmo padrão de observability/retention.ts e flush.ts: setInterval em processo, dedupe via
// global pra sobreviver a hot-reload em dev. Mesma ressalva já aceita nos outros dois: assume
// processo long-lived — se o deploy for serverless-only, isto não substitui um cron externo.
export function startEntrySchedulingSweep(): void {
  if (globalThis.__cmsSchedulingTimer) return;

  const timer = setInterval(() => {
    void processScheduledEntries();
  }, CMS_SCHEDULING_INTERVAL_MS);
  timer.unref?.();
  globalThis.__cmsSchedulingTimer = timer;
}

export function stopEntrySchedulingSweep(): void {
  if (globalThis.__cmsSchedulingTimer) {
    clearInterval(globalThis.__cmsSchedulingTimer);
    globalThis.__cmsSchedulingTimer = undefined;
  }
}

if (inProcessJobsEnabled()) {
  startEntrySchedulingSweep();
}
