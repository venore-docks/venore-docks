import type { OperationResult } from "@/shared/types";

export const SPEECH_CLIP_STATUSES = ["pending", "processing", "ready", "failed"] as const;
export type SpeechClipStatus = (typeof SPEECH_CLIP_STATUSES)[number];

// Um texto que o dono quer com áudio. `locale` é o do conteúdo ("pt-BR", "en", "ja"); o context
// traduz para o código que o provedor espera.
export type SpeechSyncItem = {
  itemKey: string;
  locale: string;
  text: string;
};

// Estado desejado de um scope inteiro: o que está na lista é criado ou atualizado; o que existia
// no scope e saiu da lista é apagado (com o MP3). Lista vazia == remover tudo do scope.
export type SyncSpeechAudioInput = {
  scope: string;
  items: SpeechSyncItem[];
};

export type SyncSpeechAudioResult = OperationResult<{ queued: number; unchanged: number; removed: number }>;

// Áudio pronto para tocar. Só sai daqui o que já foi gerado para o texto atual.
export type SpeechAudio = {
  itemKey: string;
  locale: string;
  url: string;
};

export type ProcessPendingSpeechResult = OperationResult<{
  synthesized: number;
  failed: number;
  skippedByLimit: number;
  remaining: number;
}>;

export type SpeechUsage = {
  month: string;
  characters: number;
  limit: number;
};
