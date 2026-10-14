import type { SpeechPort, SpeechVoiceOption } from "./speech-port";

// Vozes do worker (scripts/speech-worker/voices.json traduz cada uma por idioma para Kokoro ou
// Piper). Trocar o mapeamento lá não regera o que já existe; trocar a voz aqui regera o que for
// publicado depois (a key entra no hash).
const WORKER_VOICES: readonly SpeechVoiceOption[] = [
  { key: "female", label: "Feminina" },
  { key: "male", label: "Masculina" },
];

// Síntese fora do app: o GitHub Actions (.github/workflows/speech-worker.yml) pega a fila por
// /api/speech/worker, gera com modelos abertos (Kokoro, Piper) e devolve o MP3. Custo zero, sem
// conta em provedor; o áudio sai no próximo ciclo do worker, não na hora.
export class WorkerSpeechAdapter implements SpeechPort {
  readonly kind = "worker" as const;
  readonly model = "worker-v1";
  readonly voices = WORKER_VOICES;
  readonly defaultVoice = "female";

  isEnabled(): boolean {
    return true;
  }

  async synthesize(): Promise<never> {
    throw new Error("No modo worker a síntese acontece fora do app (scripts/speech-worker).");
  }
}
