import { speechPort, speechWorkerTrigger, type SpeechWorkerRun } from "@/infrastructure/speech";
import type { OperationResult } from "@/shared/types";
import { findLastSynthesizedAt, findWorkerHeartbeat } from "../../shared/store";
import type { SpeechWorkerActivity } from "../../contracts/types";

export type SpeechWorkerInfo = {
  // Só faz sentido com SPEECH_DRIVER=worker.
  applies: boolean;
  // SPEECH_WORKER_GITHUB_TOKEN presente: o app dispara o worker e lê a execução mais recente.
  canDispatch: boolean;
  actionsUrl: string;
  latestRun: SpeechWorkerRun | null;
  lastSynthesizedAt: string | null;
  activity: SpeechWorkerActivity;
};

// Sem sinal por mais que isso, a fase informada já não vale (execução morreu ou acabou o tempo).
const STALE_AFTER_MS = 10 * 60_000;

// O que o worker está fazendo agora, pelo último sinal de vida. Só contagem/fase, sem texto:
// também vai para a tela de edição do dono do conteúdo (plugins via SDK).
export async function getSpeechWorkerActivity(): Promise<SpeechWorkerActivity> {
  if (speechPort.kind !== "worker") return { mode: speechPort.kind, stage: null, since: null, lastSignalAt: null };
  const heartbeat = await findWorkerHeartbeat();
  if (!heartbeat) return { mode: "worker", stage: null, since: null, lastSignalAt: null };
  const fresh = Date.now() - heartbeat.updatedAt.getTime() < STALE_AFTER_MS;
  const stage = heartbeat.stage === "finished" ? "finished" : fresh ? (heartbeat.stage as "preparing" | "generating") : "silent";
  return { mode: "worker", stage, since: heartbeat.startedAt.toISOString(), lastSignalAt: heartbeat.updatedAt.toISOString() };
}

// Painel /admin/speech: situação do worker do GitHub Actions. Quem chama já checou settings.manage.
export async function getSpeechWorkerInfo(): Promise<OperationResult<SpeechWorkerInfo>> {
  const applies = speechPort.kind === "worker";
  const [latestRun, lastSynthesizedAt, activity] = await Promise.all([
    applies ? speechWorkerTrigger.latestRun() : Promise.resolve(null),
    findLastSynthesizedAt(),
    getSpeechWorkerActivity(),
  ]);
  return {
    success: true,
    data: {
      applies,
      canDispatch: applies && speechWorkerTrigger.isConfigured(),
      actionsUrl: speechWorkerTrigger.actionsUrl,
      latestRun,
      lastSynthesizedAt: lastSynthesizedAt?.toISOString() ?? null,
      activity,
    },
  };
}

// Botão "Gerar agora" do painel. Quem chama já checou settings.manage.
export async function requestSpeechWorkerRun(): Promise<OperationResult<{ dispatched: true }>> {
  if (speechPort.kind !== "worker") {
    return { success: false, error: { code: "speech.not_worker", message: "Só vale com SPEECH_DRIVER=worker." } };
  }
  const result = await speechWorkerTrigger.dispatch();
  if (!result.ok) return { success: false, error: { code: "speech.dispatch_failed", message: result.error ?? "Falha ao pedir a execução." } };
  return { success: true, data: { dispatched: true } };
}
