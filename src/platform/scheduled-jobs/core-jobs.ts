import { deleteStalePasswordResetTokens } from "@/contexts/auth";
import { processScheduledEntries, flushEntryViews } from "@/contexts/cms";
import { reconcileOrphanUploads } from "@/contexts/media";
import { processPendingSpeech } from "@/contexts/speech";
import { deleteExpiredRateLimits } from "@/infrastructure/rate-limit";
import { flushObservabilityBuffers, runObservabilityRetention } from "@/observability";
import { sweepSoftDeletedMedia } from "@/platform/media-lifecycle/sweep-soft-deleted-media";
import { syncCmsEntrySpeech } from "@/platform/speech/sync-cms-entry-speech";
import type { ScheduledJob } from "./types";

// Tarefas do core. Os mesmos sweeps continuam com timer em processo no self-host
// (IN_PROCESS_JOBS); aqui é o caminho confiável em serverless (endpoint de cron).
export const CORE_SCHEDULED_JOBS: ScheduledJob[] = [
  {
    key: "cms.publish-scheduled-entries",
    intervalMinutes: 1,
    run: async () => ({ success: true, data: await processScheduledEntries() }),
  },
  { key: "cms.flush-entry-views", intervalMinutes: 1, run: async () => ({ success: true, data: await flushEntryViews() }) },
  // Leitura em voz alta: primeiro enfileira o texto das entries que mudaram, depois sintetiza a
  // fila (de todos os donos — CMS e plugins) dentro do teto mensal.
  { key: "speech.sync-cms-entries", intervalMinutes: 1, run: () => syncCmsEntrySpeech() },
  { key: "speech.process-pending", intervalMinutes: 1, run: () => processPendingSpeech() },
  { key: "observability.flush", intervalMinutes: 1, run: async () => ({ success: true, data: await flushObservabilityBuffers() }) },
  {
    key: "observability.retention",
    intervalMinutes: 24 * 60,
    run: async () => ({ success: true, data: await runObservabilityRetention() }),
  },
  { key: "media.reconcile-orphan-uploads", intervalMinutes: 6 * 60, run: async () => ({ success: true, data: await reconcileOrphanUploads() }) },
  { key: "media.sweep-soft-deleted", intervalMinutes: 24 * 60, run: async () => ({ success: true, data: await sweepSoftDeletedMedia() }) },
  { key: "platform.rate-limit-cleanup", intervalMinutes: 60, run: async () => ({ success: true, data: await deleteExpiredRateLimits() }) },
  {
    key: "auth.password-reset-tokens-cleanup",
    intervalMinutes: 6 * 60,
    run: async () => ({ success: true, data: await deleteStalePasswordResetTokens(new Date()) }),
  },
];
