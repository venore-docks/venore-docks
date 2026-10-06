import { GoogleCloudTtsAdapter } from "./google-cloud-tts-adapter";
import type { SpeechPort } from "./speech-port";

class DisabledSpeechAdapter implements SpeechPort {
  readonly model = "disabled";
  isEnabled(): boolean {
    return false;
  }
  async synthesize(): Promise<never> {
    throw new Error("Leitura em voz alta não configurada (GOOGLE_TTS_API_KEY).");
  }
}

// Leitura em voz alta (docs/speech/google-cloud-tts.md). Só existe um provedor; sem a chave, a
// geração fica desligada e nenhum botão de ouvir aparece. GOOGLE_TTS_ENDPOINT só troca o endereço
// da API (servidor falso em teste local, proxy) — mesmo papel de S3_ENDPOINT.
export function createSpeechPort(env: Record<string, string | undefined> = process.env): SpeechPort {
  const apiKey = env.GOOGLE_TTS_API_KEY?.trim();
  if (!apiKey) return new DisabledSpeechAdapter();
  return new GoogleCloudTtsAdapter(apiKey, fetch, env.GOOGLE_TTS_ENDPOINT?.trim() || undefined);
}

export const speechPort: SpeechPort = createSpeechPort();

export type { SpeechPort, SpeechSynthesisInput, SpeechSynthesisOutput } from "./speech-port";
