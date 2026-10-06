// Leitura em voz alta (docs/speech/google-cloud-tts.md): áudio gerado uma vez depois da
// publicação, guardado como MP3 público na mídia, tocado sem chamar o provedor.
//
// Sem sessão e sem authorizeActor: quem sincroniza é o código de publicação do dono do conteúdo
// (CMS via platform/speech, plugins via @venore/plugin-sdk/speech), e a leitura é pública.
export { syncSpeechAudio } from "./features/sync-speech-audio/service";
export { processPendingSpeech, scheduleSpeechProcessing } from "./features/process-pending-speech/service";
export { getSpeechAudio } from "./features/get-speech-audio/service";
export type { GetSpeechAudioQuery, GetSpeechAudioResult } from "./features/get-speech-audio/service";
// Painel do admin: quem chama precisa ter checado settings.manage.
export { getSpeechStatus } from "./features/get-speech-status/service";
export type { SpeechStatus } from "./features/get-speech-status/service";
export { findSpeechMediaUsage } from "./features/find-media-usage/service";
export { listSpeechScopes } from "./features/list-speech-scopes/service";
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
export { SPEECH_VOICES, DEFAULT_SPEECH_VOICE, isSpeechVoice } from "./shared/language";
export type {
  SpeechAudio,
  SpeechSyncItem,
  SyncSpeechAudioInput,
  SyncSpeechAudioResult,
  ProcessPendingSpeechResult,
} from "./contracts/types";
