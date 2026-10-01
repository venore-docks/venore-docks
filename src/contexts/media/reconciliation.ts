import { db } from "@/infrastructure/database/client";
import { storagePort } from "@/infrastructure/storage";
import { assetVariants, assets } from "./database/schema";
import { inProcessJobsEnabled } from "@/shared/in-process-jobs";

// Upload órfão (Fase 4/M2 — docs/implementation-roadmap.md, docs/media/blob-spec.md seção 8):
// o browser subiu o blob mas fechou a aba antes de confirmar (confirmMediaUpload nunca chegou a
// rodar), ou o registro falhou de outro jeito. Compara os objetos reais do storage contra os
// `pathname`s conhecidos em `media.assets` (inclusive soft-deletados — o blob deles ainda existe
// até o purge, então não são "órfãos"); blobs sem nenhuma linha e mais antigos que o TTL de graça
// são removidos. Roda como processo de sistema (sem authorizeActor), mesmo padrão de
// cms/scheduling.ts e observability/retention.ts.
const ORPHAN_GRACE_PERIOD_MS = 24 * 60 * 60 * 1000;

export async function reconcileOrphanUploads(now: Date = new Date()): Promise<{ removed: number }> {
  const knownRows = await db.select({ pathname: assets.pathname }).from(assets);
  // Variante de imagem tem objeto próprio no storage (image-variants.ts) — sem isso, a varredura
  // tomaria toda variante por upload órfão e apagaria.
  const variantRows = await db.select({ pathname: assetVariants.pathname }).from(assetVariants);
  const knownPathnames = new Set([...knownRows, ...variantRows].map((row) => row.pathname));

  const objects = await storagePort.listObjects();
  const cutoff = now.getTime() - ORPHAN_GRACE_PERIOD_MS;

  let removed = 0;
  for (const object of objects) {
    if (knownPathnames.has(object.key)) continue;
    if (object.uploadedAt.getTime() > cutoff) continue;

    await storagePort.remove(object.key);
    removed += 1;
  }

  return { removed };
}

declare global {
  var __mediaReconciliationTimer: ReturnType<typeof setInterval> | undefined;
}

const MEDIA_RECONCILIATION_INTERVAL_MS = 6 * 60 * 60 * 1000;

// Mesmo padrão de setInterval+dedupe global já usado em observability/retention.ts,
// observability/flush.ts, cms/scheduling.ts e cms/view-tracking.ts.
export function startMediaReconciliationSweep(): void {
  if (globalThis.__mediaReconciliationTimer) return;

  const timer = setInterval(() => {
    void reconcileOrphanUploads();
  }, MEDIA_RECONCILIATION_INTERVAL_MS);
  timer.unref?.();
  globalThis.__mediaReconciliationTimer = timer;
}

export function stopMediaReconciliationSweep(): void {
  if (globalThis.__mediaReconciliationTimer) {
    clearInterval(globalThis.__mediaReconciliationTimer);
    globalThis.__mediaReconciliationTimer = undefined;
  }
}

if (inProcessJobsEnabled()) {
  startMediaReconciliationSweep();
}
