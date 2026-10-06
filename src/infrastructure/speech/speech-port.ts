export type SpeechSynthesisInput = {
  text: string;
  // BCP-47 com região, como o provedor espera ("pt-BR", "en-US", "ja-JP").
  languageCode: string;
  // Nome curto da voz ("Kore"); o adapter monta o nome completo do provedor.
  voice: string;
};

export type SpeechSynthesisOutput = {
  audio: Buffer;
  contentType: string;
  // Caracteres cobrados pelo provedor (o Google cobra por caractere de entrada).
  billedCharacters: number;
};

export interface SpeechPort {
  isEnabled(): boolean;
  // Identifica provedor + modelo: entra no hash do áudio guardado, pra trocar de modelo gerar de novo.
  readonly model: string;
  synthesize(input: SpeechSynthesisInput): Promise<SpeechSynthesisOutput>;
}
