import { GoogleCloudTtsAdapter } from "./google-cloud-tts-adapter";
import type { SpeechPort } from "./speech-port";
import { WorkerSpeechAdapter } from "./worker-speech-adapter";

class DisabledSpeechAdapter implements SpeechPort {
  readonly kind = "disabled" as const;
  readonly model = "disabled";
  readonly voices = [];
  readonly defaultVoice = "";
  isEnabled(): boolean {
    return false;
  }
  async synthesize(): Promise<never> {
    throw new Error("Leitura em voz alta não configurada (SPEECH_DRIVER).");
  }
}

// Leitura em voz alta (docs/speech/leitura-em-voz-alta.md). SPEECH_DRIVER:
// - "worker": síntese grátis fora do app (GitHub Actions + Kokoro/Piper), fila pela API
//   /api/speech/worker autenticada com CRON_SECRET — sem CRON_SECRET fica desligado.
// - "google": Google Cloud TTS (GOOGLE_TTS_API_KEY; GOOGLE_TTS_ENDPOINT só troca o endereço, para
//   servidor falso em teste local ou proxy). Ausente com a chave presente também vale "google".
// - qualquer outra coisa / nada: desligado, nenhum botão de ouvir aparece.
export function createSpeechPort(env: Record<string, string | undefined> = process.env): SpeechPort {
  const driver = env.SPEECH_DRIVER?.trim() || (env.GOOGLE_TTS_API_KEY?.trim() ? "google" : "");
  if (driver === "worker") {
    return env.CRON_SECRET?.trim() ? new WorkerSpeechAdapter() : new DisabledSpeechAdapter();
  }
  if (driver === "google") {
    const apiKey = env.GOOGLE_TTS_API_KEY?.trim();
    if (!apiKey) return new DisabledSpeechAdapter();
    return new GoogleCloudTtsAdapter(apiKey, fetch, env.GOOGLE_TTS_ENDPOINT?.trim() || undefined);
  }
  return new DisabledSpeechAdapter();
}

export const speechPort: SpeechPort = createSpeechPort();

export type { SpeechPort, SpeechPortKind, SpeechSynthesisInput, SpeechSynthesisOutput, SpeechVoiceOption } from "./speech-port";
