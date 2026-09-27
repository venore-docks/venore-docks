import { listSoftDeletedAssetsOlderThan, purgeMediaAssetAsSystem } from "@/contexts/media";
import { getSetting, registerDefaultSetting } from "@/contexts/settings";
import { collectMediaUsage } from "@/platform/media-usage/media-usage-registry";
import { inProcessJobsEnabled } from "@/shared/in-process-jobs";

const MEDIA_SOFT_DELETE_GRACE_DAYS_SETTING_KEY = "media.softDeleteGraceDays";
const DEFAULT_GRACE_DAYS = 3;

async function getGraceDays(): Promise<number> {
  await registerDefaultSetting({ key: MEDIA_SOFT_DELETE_GRACE_DAYS_SETTING_KEY, value: DEFAULT_GRACE_DAYS });
  const result = await getSetting({ key: MEDIA_SOFT_DELETE_GRACE_DAYS_SETTING_KEY });
  if (!result.success || !result.data || typeof result.data.value !== "number") return DEFAULT_GRACE_DAYS;
  return result.data.value;
}

// Autopurge (blob-spec seção 7, decisão desta sessão: 3 dias de graça em vez dos 14 originalmente
// propostos) — ponto de composição fora de media (regra 12/14, mesmo motivo de delete-media-
// safely.ts/purge-media-safely.ts): reconfirma uso via collectMediaUsage pra cada candidato antes
// de apagar de vez, porque algo pode ter voltado a referenciar o asset desde o soft delete.
export async function sweepSoftDeletedMedia(now: Date = new Date()): Promise<{ purged: number; skipped: number }> {
  const graceDays = await getGraceDays();
  const cutoff = new Date(now.getTime() - graceDays * 24 * 60 * 60 * 1000);

  const candidates = await listSoftDeletedAssetsOlderThan(cutoff);

  let purged = 0;
  let skipped = 0;

  for (const asset of candidates) {
    const usage = await collectMediaUsage(asset.id);
    if (usage.length > 0) {
      // Anomalia: um asset soft-deletado voltar a ser referenciado não deveria acontecer (a UI
      // exclui soft-deletados dos pickers) — se acontecer, é sinal de bug em outro lugar. Pula
      // sem purgar e sem restaurar sozinho, pra não esconder o sinal.
      console.warn(`[media] sweep: asset "${asset.id}" (${asset.filename}) soft-deletado mas ainda referenciado — pulando purge.`);
      skipped += 1;
      continue;
    }

    const result = await purgeMediaAssetAsSystem({ id: asset.id, actorId: "system" });
    if (result.success) purged += 1;
  }

  if (purged > 0 || skipped > 0) {
    console.info(`[media] sweep de autopurge: ${purged} apagados, ${skipped} pulados (ainda em uso).`);
  }

  return { purged, skipped };
}

declare global {
  var __mediaSoftDeleteSweepTimer: ReturnType<typeof setInterval> | undefined;
}

const MEDIA_SOFT_DELETE_SWEEP_INTERVAL_MS = 24 * 60 * 60 * 1000;

// Mesmo padrão de setInterval+dedupe global já usado em contexts/media/reconciliation.ts,
// observability/retention.ts, observability/flush.ts, cms/scheduling.ts e cms/view-tracking.ts.
export function startMediaSoftDeleteSweep(): void {
  if (globalThis.__mediaSoftDeleteSweepTimer) return;

  const timer = setInterval(() => {
    void sweepSoftDeletedMedia();
  }, MEDIA_SOFT_DELETE_SWEEP_INTERVAL_MS);
  timer.unref?.();
  globalThis.__mediaSoftDeleteSweepTimer = timer;
}

export function stopMediaSoftDeleteSweep(): void {
  if (globalThis.__mediaSoftDeleteSweepTimer) {
    clearInterval(globalThis.__mediaSoftDeleteSweepTimer);
    globalThis.__mediaSoftDeleteSweepTimer = undefined;
  }
}

if (inProcessJobsEnabled()) {
  startMediaSoftDeleteSweep();
}
