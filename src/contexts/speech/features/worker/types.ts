import type { OperationResult } from "@/shared/types";

// Um texto para o worker externo sintetizar. `textHash` volta junto na entrega: se o texto mudou
// no meio, a entrega é descartada.
export type SpeechWorkJob = {
  id: string;
  textHash: string;
  locale: string;
  languageCode: string;
  voice: string;
  text: string;
};

export type ClaimSpeechWorkResult = OperationResult<{ jobs: SpeechWorkJob[]; limitReached: boolean }>;
export type CompleteSpeechWorkInput = { id: string; textHash: string; audio: Buffer; contentType: string };
export type CompleteSpeechWorkResult = OperationResult<{ stored: boolean }>;
export type FailSpeechWorkInput = { id: string; textHash: string; error: string };
export type SpeechWorkStatus = OperationResult<{ mode: string; enabled: boolean; pending: number }>;
