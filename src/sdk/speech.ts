// Leitura em voz alta para plugins (docs/speech/leitura-em-voz-alta.md). O plugin descreve o estado
// desejado de cada scope seu na publicação (syncSpeechAudio) e lê as URLs prontas para tocar
// (getSpeechAudio). Convenção: scope começa com a key do plugin ("novels.work:<id>").
// Fila, teto mensal, settings e cursores ficam de fora — são do core.
export { syncSpeechAudio, getSpeechAudio } from "@/contexts/speech";
export type {
  GetSpeechAudioQuery,
  GetSpeechAudioResult,
  SpeechAudio,
  SpeechSyncItem,
  SyncSpeechAudioInput,
  SyncSpeechAudioResult,
} from "@/contexts/speech";
