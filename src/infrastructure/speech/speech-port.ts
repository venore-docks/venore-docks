export type SpeechSynthesisInput = {
  text: string;
  // BCP-47 com região, como o provedor espera ("pt-BR", "en-US", "ja-JP").
  languageCode: string;
  // Chave curta da voz ("Kore", "female"); o adapter traduz para o nome do provedor.
  voice: string;
};

export type SpeechSynthesisOutput = {
  audio: Buffer;
  contentType: string;
  // Caracteres cobrados pelo provedor (o Google cobra por caractere de entrada).
  billedCharacters: number;
};

export type SpeechVoiceOption = { key: string; label: string };

// "inline": o próprio app chama o provedor (Google). "worker": quem sintetiza é um processo de
// fora (GitHub Actions, scripts/speech-worker) que pega a fila pela API /api/speech/worker.
export type SpeechPortKind = "inline" | "worker" | "disabled";

export interface SpeechPort {
  readonly kind: SpeechPortKind;
  isEnabled(): boolean;
  // Identifica provedor + modelo: entra no hash do áudio guardado, pra trocar de modelo gerar de novo.
  readonly model: string;
  // Vozes oferecidas em /admin/settings (a setting guarda a key).
  readonly voices: readonly SpeechVoiceOption[];
  readonly defaultVoice: string;
  synthesize(input: SpeechSynthesisInput): Promise<SpeechSynthesisOutput>;
}
