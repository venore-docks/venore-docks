import { getSetting } from "@/contexts/settings";
import { defaultSpeechVoice, isSpeechVoice } from "./voices";

// Settings da leitura em voz alta (namespace core "speech" ⇒ escrita exige settings.manage). A
// escolha do provedor e as chaves vêm da env (SPEECH_DRIVER, CRON_SECRET, GOOGLE_TTS_API_KEY), nunca de setting.
export const SPEECH_ENABLED_SETTING_KEY = "speech.enabled";
export const SPEECH_VOICE_SETTING_KEY = "speech.voice";
export const SPEECH_MONTHLY_LIMIT_SETTING_KEY = "speech.monthly_character_limit";

// Teto de volume por mês. No Google é 90% da cota grátis do Chirp 3 HD (1 milhão de caracteres);
// no worker não há cobrança, o teto só segura o tempo de GitHub Actions.
export const DEFAULT_MONTHLY_CHARACTER_LIMIT = 900_000;
export const MAX_MONTHLY_CHARACTER_LIMIT = 50_000_000;

export type SpeechSettings = { enabled: boolean; voice: string; monthlyCharacterLimit: number };

// Leitura tolerante: setting ausente, de tipo errado ou erro de leitura cai no padrão seguro
// (desligado, voz padrão, teto padrão).
export async function readSpeechSettings(): Promise<SpeechSettings> {
  const [enabled, voice, limit] = await Promise.all([
    getSetting({ key: SPEECH_ENABLED_SETTING_KEY }),
    getSetting({ key: SPEECH_VOICE_SETTING_KEY }),
    getSetting({ key: SPEECH_MONTHLY_LIMIT_SETTING_KEY }),
  ]);
  const enabledValue = enabled.success ? enabled.data?.value : undefined;
  const voiceValue = voice.success ? voice.data?.value : undefined;
  const limitValue = limit.success ? limit.data?.value : undefined;
  return {
    enabled: enabledValue === true,
    voice: typeof voiceValue === "string" && isSpeechVoice(voiceValue) ? voiceValue : defaultSpeechVoice(),
    monthlyCharacterLimit:
      typeof limitValue === "number" && Number.isInteger(limitValue) && limitValue >= 0 && limitValue <= MAX_MONTHLY_CHARACTER_LIMIT
        ? limitValue
        : DEFAULT_MONTHLY_CHARACTER_LIMIT,
  };
}
