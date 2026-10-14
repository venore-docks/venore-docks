// Leitura em voz alta (docs/speech/leitura-em-voz-alta.md): áudio gerado uma vez depois da
// publicação, guardado como MP3 público na mídia, tocado sem chamar o provedor.
//
// Sem sessão e sem authorizeActor: quem sincroniza é o código de publicação do dono do conteúdo
// (CMS via platform/speech, plugins via @venore/plugin-sdk/speech), e a leitura é pública.
export { syncSpeechAudio } from "./features/sync-speech-audio/service";
export { processPendingSpeech, scheduleSpeechProcessing } from "./features/process-pending-speech/service";
export { getSpeechAudio } from "./features/get-speech-audio/service";
// Andamento por scope (só contagens) — tela de edição do dono do conteúdo; plugins via SDK.
export { getSpeechProgress } from "./features/get-speech-progress/service";
// Estado do áudio contra o texto atual do dono (pronto, desatualizado, faltando...) — plugins via SDK.
export { getSpeechState } from "./features/get-speech-state/service";
// Worker externo (SPEECH_DRIVER=worker): só as rotas /api/speech/worker chamam, depois de
// conferir o CRON_SECRET.
export {
  getSpeechWorkStatus,
  claimSpeechWork,
  completeSpeechWork,
  failSpeechWork,
  reportSpeechWorkProgress,
  recordSpeechWorkerStage,
} from "./features/worker/service";
export type { SpeechWorkJob } from "./features/worker/types";
export type { GetSpeechAudioQuery, GetSpeechAudioResult } from "./features/get-speech-audio/service";
// Painel do admin: quem chama precisa ter checado settings.manage.
export { getSpeechStatus } from "./features/get-speech-status/service";
export type { SpeechStatus } from "./features/get-speech-status/service";
export { findSpeechMediaUsage } from "./features/find-media-usage/service";
export { listSpeechScopes } from "./features/list-speech-scopes/service";
// Painel /admin/speech: quem chama precisa ter checado settings.manage.
export { listSpeechQueue } from "./features/list-speech-queue/service";
export type { SpeechQueueItem } from "./features/list-speech-queue/service";
export { retryFailedSpeech } from "./features/retry-failed-speech/service";
export { regenerateSpeech } from "./features/regenerate-speech/service";
export { getSpeechWorkerInfo, requestSpeechWorkerRun, getSpeechWorkerActivity } from "./features/speech-worker-run/service";
export type { SpeechWorkerInfo } from "./features/speech-worker-run/service";
export { getSpeechSyncCursor, setSpeechSyncCursor } from "./features/sync-cursor/service";
export { readSpeechSettings } from "./shared/speech-settings";
export type { SpeechSettings } from "./shared/speech-settings";
export {
  SPEECH_ENABLED_SETTING_KEY,
  SPEECH_VOICE_SETTING_KEY,
  SPEECH_MONTHLY_LIMIT_SETTING_KEY,
  DEFAULT_MONTHLY_CHARACTER_LIMIT,
  MAX_MONTHLY_CHARACTER_LIMIT,
} from "./shared/speech-settings";
export { speechVoices, isSpeechVoice } from "./shared/voices";
export type {
  SpeechAudio,
  SpeechProgress,
  SpeechWorkerActivity,
  SpeechState,
  GetSpeechStateInput,
  GetSpeechStateResult,
  GetSpeechProgressQuery,
  GetSpeechProgressResult,
  SpeechSyncItem,
  SyncSpeechAudioInput,
  SyncSpeechAudioResult,
  ProcessPendingSpeechResult,
} from "./contracts/types";

export { speechAdminNavigationItems } from "./admin-navigation";
export { speechBreadcrumbSegments } from "./breadcrumbs";
