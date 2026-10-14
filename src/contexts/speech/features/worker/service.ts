import { deleteGeneratedAssets, storeGeneratedAsset } from "@/contexts/media";
import { speechPort } from "@/infrastructure/speech";
import type { OperationResult } from "@/shared/types";
import { beginOperation, endOperation } from "@/observability";
import {
  MAX_SYNTHESIS_ATTEMPTS,
  MAX_WORKER_AUDIO_BYTES,
  SPEECH_MEDIA_CATEGORY_KEY,
  SPEECH_MEDIA_CATEGORY_NAME,
} from "../../shared/constants";
import { currentUsageMonth, speechLanguageCode } from "../../shared/language";
import { readSpeechSettings } from "../../shared/speech-settings";
import {
  claimPendingClips,
  countClipsByStatus,
  findProcessingClip,
  markClipReady,
  recordWorkerHeartbeat,
  setClipProgress,
  recordClipFailure,
  refundUsage,
  releaseClip,
  reserveUsage,
} from "../../shared/store";
import {
  SPEECH_WORKER_STAGES,
  type ClaimSpeechWorkResult,
  type CompleteSpeechWorkInput,
  type CompleteSpeechWorkResult,
  type FailSpeechWorkInput,
  type ReportSpeechWorkProgressInput,
  type SpeechWorkerStage,
  type SpeechWorkJob,
  type SpeechWorkStatus,
} from "./types";

const ACTOR = { id: "speech-worker", type: "system" } as const;
const MAX_CLAIM = 50;

async function workerActive(): Promise<boolean> {
  return speechPort.kind === "worker" && (await readSpeechSettings()).enabled;
}

// Quanto há na fila — o worker consulta antes de instalar os modelos (barato quando não há nada).
export async function getSpeechWorkStatus(): Promise<SpeechWorkStatus> {
  const enabled = await workerActive();
  const counts = await countClipsByStatus();
  return { success: true, data: { mode: speechPort.kind, enabled, pending: enabled ? counts.pending : 0 } };
}

// Reserva até `limit` textos para o worker (mesma reserva atômica do modo inline: dois workers
// nunca pegam o mesmo) e a cota do mês de cada um. Ao bater no teto, devolve o que reservou e
// avisa — o resto espera o mês seguinte.
export async function claimSpeechWork(limit: number): Promise<ClaimSpeechWorkResult> {
  if (!(await workerActive())) return { success: true, data: { jobs: [], limitReached: false } };
  const settings = await readSpeechSettings();
  const month = currentUsageMonth();
  const claimed = await claimPendingClips(Math.max(1, Math.min(MAX_CLAIM, Math.floor(limit))));

  const jobs: SpeechWorkJob[] = [];
  let limitReached = false;
  for (const clip of claimed) {
    const languageCode = speechLanguageCode(clip.locale);
    if (limitReached || !languageCode || !(await reserveUsage(month, clip.characters, settings.monthlyCharacterLimit))) {
      limitReached ||= Boolean(languageCode);
      await releaseClip(clip.id, clip.textHash);
      continue;
    }
    jobs.push({ id: clip.id, textHash: clip.textHash, locale: clip.locale, languageCode, voice: clip.voice, text: clip.text });
  }
  return { success: true, data: { jobs, limitReached } };
}

// Entrega do MP3. Só grava se o clip ainda está reservado com o mesmo texto; senão (texto mudou,
// reserva venceu e outro worker pegou) devolve stored: false e o MP3 é descartado.
export async function completeSpeechWork(input: CompleteSpeechWorkInput): Promise<CompleteSpeechWorkResult> {
  const handle = beginOperation({ useCase: "speech.worker-complete", actor: ACTOR, kind: "write" });
  const fail = (code: string, message: string): CompleteSpeechWorkResult => {
    const error = { code, message };
    endOperation(handle, { success: false, error });
    return { success: false, error };
  };

  if (input.contentType !== "audio/mpeg") return fail("speech.worker.invalid_type", "Envie o áudio como audio/mpeg.");
  if (input.audio.length === 0 || input.audio.length > MAX_WORKER_AUDIO_BYTES) {
    return fail("speech.worker.invalid_size", "Áudio vazio ou maior que o limite.");
  }
  if (!(await findProcessingClip(input.id, input.textHash))) {
    endOperation(handle, { success: true });
    return { success: true, data: { stored: false } };
  }

  const stored = await storeGeneratedAsset({
    filename: `leitura-${input.id}.mp3`,
    contentType: "audio/mpeg",
    data: input.audio,
    categoryKey: SPEECH_MEDIA_CATEGORY_KEY,
    categoryName: SPEECH_MEDIA_CATEGORY_NAME,
  });
  if (!stored.success) return fail(stored.error.code, stored.error.message);

  if (!(await markClipReady(input.id, input.textHash, stored.data.id))) {
    await deleteGeneratedAssets({ ids: [stored.data.id], categoryKey: SPEECH_MEDIA_CATEGORY_KEY });
    endOperation(handle, { success: true });
    return { success: true, data: { stored: false } };
  }
  endOperation(handle, { success: true });
  return { success: true, data: { stored: true } };
}

// O worker não conseguiu gerar: devolve a cota reservada e conta a tentativa.
export async function failSpeechWork(input: FailSpeechWorkInput): Promise<CompleteSpeechWorkResult> {
  const clip = await findProcessingClip(input.id, input.textHash);
  if (!clip) return { success: true, data: { stored: false } };
  await refundUsage(currentUsageMonth(), clip.characters);
  await recordClipFailure(input.id, input.textHash, input.error, MAX_SYNTHESIS_ATTEMPTS);
  return { success: true, data: { stored: false } };
}

// Andamento do texto em síntese (0–100). false = o clip já não está reservado com esse texto
// (mudou ou foi pego por outro): o worker pode parar e descartar.
export async function reportSpeechWorkProgress(input: ReportSpeechWorkProgressInput): Promise<OperationResult<{ active: boolean }>> {
  if (!Number.isFinite(input.percent)) {
    return { success: false, error: { code: "speech.worker.invalid_progress", message: "percent precisa ser um número." } };
  }
  return { success: true, data: { active: await setClipProgress(input.id, input.textHash, input.percent) } };
}

// Sinal de vida do worker: em que fase está (o painel mostra "preparando as vozes", "gerando").
export async function recordSpeechWorkerStage(input: { stage: string; detail?: string | null }): Promise<OperationResult<{ stage: SpeechWorkerStage }>> {
  const stage = SPEECH_WORKER_STAGES.find((candidate) => candidate === input.stage);
  if (!stage) return { success: false, error: { code: "speech.worker.invalid_stage", message: `Fase desconhecida: ${input.stage}.` } };
  await recordWorkerHeartbeat(stage, input.detail ? String(input.detail).slice(0, 300) : null);
  return { success: true, data: { stage } };
}
