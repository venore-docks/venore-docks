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
  // Como o painel de áudios (/admin/speech) mostra o scope: título do conteúdo e link do editor.
  // Opcional; sem ele o painel mostra o nome cru do scope.
  source?: { label: string; href?: string | null };
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

// Andamento do áudio de um scope (uma obra, uma entry): quantos textos estão prontos, na fila,
// sendo gerados agora ou com falha (que só voltam à fila quando alguém pede de novo).
export type SpeechProgress = {
  total: number;
  ready: number;
  pending: number;
  processing: number;
  failed: number;
  // Percentual (0–99) do texto sendo gerado agora, informado pelo worker; null sem geração em curso.
  currentPercent: number | null;
  lastError: string | null;
  updatedAt: string | null;
};

export type GetSpeechProgressQuery = { scopes: string[] };
export type GetSpeechProgressResult = OperationResult<Record<string, SpeechProgress>>;

// O que o worker (SPEECH_DRIVER=worker) está fazendo, pelo último sinal de vida:
// preparing = achou fila e está instalando as vozes; generating = gerando; finished = terminou a
// última execução; silent = parou de avisar no meio (execução morreu); null = nunca avisou ou não
// é o modo worker. `since` = início da fase atual.
export type SpeechWorkerActivity = {
  mode: "inline" | "worker" | "disabled";
  stage: "preparing" | "generating" | "finished" | "silent" | null;
  since: string | null;
  lastSignalAt: string | null;
};
