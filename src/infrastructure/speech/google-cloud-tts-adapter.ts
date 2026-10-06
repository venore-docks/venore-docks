import type { SpeechPort, SpeechSynthesisInput, SpeechSynthesisOutput } from "./speech-port";
import { splitTextForSynthesis } from "./split-text";

export const GOOGLE_TTS_ENDPOINT = "https://texttospeech.googleapis.com/v1/text:synthesize";
const REQUEST_TIMEOUT_MS = 30_000;

type SynthesizeResponse = { audioContent?: string };
type ErrorResponse = { error?: { code?: number; message?: string; status?: string } };

// MP3 de cada pedaço pode vir com cabeçalho ID3v2; concatenado no meio do arquivo ele vira ruído
// em alguns players. Só o primeiro pedaço mantém o seu.
function stripId3(buffer: Buffer): Buffer {
  if (buffer.length < 10 || buffer.toString("latin1", 0, 3) !== "ID3") return buffer;
  const size = ((buffer[6] & 0x7f) << 21) | ((buffer[7] & 0x7f) << 14) | ((buffer[8] & 0x7f) << 7) | (buffer[9] & 0x7f);
  const footer = buffer[5] & 0x10 ? 10 : 0;
  return buffer.subarray(10 + size + footer);
}

// Google Cloud Text-to-Speech pela API REST, autenticado por chave de API (restrita no console à
// "Cloud Text-to-Speech API" — docs/speech/google-cloud-tts.md). Vozes Chirp 3 HD: sem SSML nem
// controle de velocidade, então o texto vai cru.
export class GoogleCloudTtsAdapter implements SpeechPort {
  readonly model = "google-chirp3-hd";

  constructor(
    private readonly apiKey: string,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly endpoint: string = GOOGLE_TTS_ENDPOINT,
  ) {}

  isEnabled(): boolean {
    return true;
  }

  async synthesize(input: SpeechSynthesisInput): Promise<SpeechSynthesisOutput> {
    const chunks = splitTextForSynthesis(input.text);
    const parts: Buffer[] = [];
    for (const [index, chunk] of chunks.entries()) {
      const audio = await this.synthesizeChunk(chunk, input);
      parts.push(index === 0 ? audio : stripId3(audio));
    }
    return {
      audio: Buffer.concat(parts),
      contentType: "audio/mpeg",
      billedCharacters: chunks.reduce((total, chunk) => total + [...chunk].length, 0),
    };
  }

  private async synthesizeChunk(text: string, input: SpeechSynthesisInput): Promise<Buffer> {
    const response = await this.fetchImpl(this.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": this.apiKey },
      body: JSON.stringify({
        input: { text },
        voice: { languageCode: input.languageCode, name: `${input.languageCode}-Chirp3-HD-${input.voice}` },
        audioConfig: { audioEncoding: "MP3" },
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as ErrorResponse;
      throw new Error(`Google Text-to-Speech respondeu ${response.status}: ${body.error?.message ?? response.statusText}`);
    }
    const body = (await response.json()) as SynthesizeResponse;
    if (!body.audioContent) throw new Error("Google Text-to-Speech respondeu sem áudio.");
    return Buffer.from(body.audioContent, "base64");
  }
}
