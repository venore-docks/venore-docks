import { waitUntil } from "@vercel/functions";
import { deleteGeneratedAssets, storeGeneratedAsset } from "@/contexts/media";
import { speechPort, speechWorkerTrigger } from "@/infrastructure/speech";
import { beginOperation, endOperation } from "@/observability";
import type { ProcessPendingSpeechResult } from "../../contracts/types";
import {
  MAX_SYNTHESIS_ATTEMPTS,
  SPEECH_MEDIA_CATEGORY_KEY,
  SPEECH_MEDIA_CATEGORY_NAME,
} from "../../shared/constants";
import { currentUsageMonth, speechLanguageCode } from "../../shared/language";
import { readSpeechSettings } from "../../shared/speech-settings";
import {
  claimPendingClips,
  countClipsByStatus,
  markClipReady,
  recordClipFailure,
  refundUsage,
  releaseClip,
  reserveUsage,
  type StoredClip,
} from "../../shared/store";

export type ProcessPendingSpeechOptions = {
  maxItems?: number;
  // O tick do cron tem 60 s para todas as tarefas; a síntese fica com uma parte.
  timeBudgetMs?: number;
  concurrency?: number;
};

type Outcome = "synthesized" | "failed" | "limit";

async function processClip(clip: StoredClip, limit: number): Promise<Outcome> {
  const month = currentUsageMonth();
  if (!(await reserveUsage(month, clip.characters, limit))) {
    await releaseClip(clip.id, clip.textHash);
    return "limit";
  }

  const languageCode = speechLanguageCode(clip.locale);
  let synthesized;
  try {
    if (!languageCode) throw new Error(`Idioma sem voz: ${clip.locale}.`);
    synthesized = await speechPort.synthesize({ text: clip.text, languageCode, voice: clip.voice });
  } catch (error) {
    await refundUsage(month, clip.characters);
    await recordClipFailure(clip.id, clip.textHash, error instanceof Error ? error.message : String(error), MAX_SYNTHESIS_ATTEMPTS);
    return "failed";
  }

  const stored = await storeGeneratedAsset({
    filename: `leitura-${clip.id}.mp3`,
    contentType: synthesized.contentType,
    data: synthesized.audio,
    categoryKey: SPEECH_MEDIA_CATEGORY_KEY,
    categoryName: SPEECH_MEDIA_CATEGORY_NAME,
  });
  if (!stored.success) {
    await recordClipFailure(clip.id, clip.textHash, stored.error.message, MAX_SYNTHESIS_ATTEMPTS);
    return "failed";
  }

  // O texto mudou enquanto sintetizava: o MP3 já não corresponde ao publicado.
  if (!(await markClipReady(clip.id, clip.textHash, stored.data.id))) {
    await deleteGeneratedAssets({ ids: [stored.data.id], categoryKey: SPEECH_MEDIA_CATEGORY_KEY });
  }
  return "synthesized";
}

// Driver "inline" (Google): esvazia a fila em lotes paralelos até acabar, estourar o tempo ou bater no teto do mês (aí o
// resto espera o mês seguinte). Roda no job do cron e logo depois de uma publicação.
export async function processPendingSpeech(options: ProcessPendingSpeechOptions = {}): Promise<ProcessPendingSpeechResult> {
  const maxItems = options.maxItems ?? 60;
  const deadline = Date.now() + (options.timeBudgetMs ?? 35_000);
  const concurrency = Math.max(1, options.concurrency ?? 4);
  const counts = { synthesized: 0, failed: 0, skippedByLimit: 0 };

  const settings = await readSpeechSettings();
  // No modo worker quem sintetiza é o processo de fora (features/worker); aqui não há o que fazer.
  if (!settings.enabled || speechPort.kind !== "inline") {
    return { success: true, data: { ...counts, remaining: (await countClipsByStatus()).pending } };
  }

  const handle = beginOperation({ useCase: "speech.process-pending", actor: { id: "system", type: "system" }, kind: "write" });
  let handled = 0;
  while (handled < maxItems && Date.now() < deadline) {
    const batch = await claimPendingClips(Math.min(concurrency, maxItems - handled));
    if (batch.length === 0) break;
    handled += batch.length;
    const outcomes = await Promise.all(batch.map((clip) => processClip(clip, settings.monthlyCharacterLimit)));
    for (const outcome of outcomes) {
      if (outcome === "synthesized") counts.synthesized += 1;
      else if (outcome === "failed") counts.failed += 1;
      else counts.skippedByLimit += 1;
    }
    if (outcomes.includes("limit")) break;
  }

  const remaining = (await countClipsByStatus()).pending;
  endOperation(handle, { success: true });
  return { success: true, data: { ...counts, remaining } };
}

// Pedidos de execução do worker em sequência (várias cenas salvas seguidas, o job do CMS) viram
// um só: o GitHub guarda no máximo uma execução pendente por vez, e esta janela evita chamadas à toa.
const DISPATCH_WINDOW_MS = 60_000;
let lastDispatchAt = 0;

// Depois de enfileirar:
// - inline (Google): gera já na Vercel (waitUntil mantém a função viva depois da resposta); o que
//   não couber fica para o job do cron. Fora da Vercel, só o cron.
// - worker: pede uma execução do workflow (SPEECH_WORKER_GITHUB_TOKEN), sem esperar o agendamento.
export function scheduleSpeechProcessing(): void {
  if (speechPort.kind === "worker") {
    if (!speechWorkerTrigger.isConfigured() || Date.now() - lastDispatchAt < DISPATCH_WINDOW_MS) return;
    lastDispatchAt = Date.now();
    waitUntil(speechWorkerTrigger.dispatch().catch(() => undefined));
    return;
  }
  if (!process.env.VERCEL || speechPort.kind !== "inline") return;
  waitUntil(processPendingSpeech({ maxItems: 12, timeBudgetMs: 25_000 }).catch(() => undefined));
}
