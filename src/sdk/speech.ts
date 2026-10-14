// Leitura em voz alta para plugins (docs/speech/leitura-em-voz-alta.md). O plugin descreve o estado
// desejado de cada scope seu na publicação (syncSpeechAudio) e lê as URLs prontas para tocar
// (getSpeechAudio). getSpeechProgress mostra o andamento na tela de edição (prontos, na fila,
// gerando, com falha), getSpeechWorkerActivity diz se o worker está trabalhando; `source` no sync dá título e link ao painel de áudios do admin (2.2.0).
// 2.3.0: getSpeechState (pronto x desatualizado x faltando contra o texto atual) e `regenerate`
// no sync — para o autor gerar, refazer e apagar o áudio por ação explícita, não ao salvar.
// Convenção: scope começa com a key do plugin ("novels.work:<id>").
// Fila, teto mensal, settings e cursores ficam de fora — são do core.
export { syncSpeechAudio, getSpeechAudio, getSpeechProgress, getSpeechState, getSpeechWorkerActivity } from "@/contexts/speech";
export type {
  GetSpeechAudioQuery,
  GetSpeechAudioResult,
  GetSpeechProgressQuery,
  GetSpeechProgressResult,
  SpeechAudio,
  SpeechProgress,
  SpeechWorkerActivity,
  SpeechState,
  GetSpeechStateInput,
  GetSpeechStateResult,
  SpeechSyncItem,
  SyncSpeechAudioInput,
  SyncSpeechAudioResult,
} from "@/contexts/speech";
