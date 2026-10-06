import { createHash } from "node:crypto";

// Locale de conteúdo -> código de idioma das vozes Chirp 3 HD. Locale já com região passa direto
// ("pt-BR"); sem região usa a variante mais comum. Locale fora da lista não ganha áudio.
const LANGUAGE_CODES: Record<string, string> = {
  pt: "pt-BR",
  en: "en-US",
  es: "es-ES",
  fr: "fr-FR",
  it: "it-IT",
  de: "de-DE",
  ja: "ja-JP",
};

export function speechLanguageCode(locale: string): string | null {
  const [language, region] = locale.split("-");
  const base = LANGUAGE_CODES[language?.toLowerCase() ?? ""];
  if (!base) return null;
  return region ? `${language.toLowerCase()}-${region.toUpperCase()}` : base;
}

// Vozes Chirp 3 HD oferecidas na setting (o Google tem 30; estas cobrem os dois timbres).
export const SPEECH_VOICES = [
  { key: "Kore", label: "Kore (feminina)" },
  { key: "Aoede", label: "Aoede (feminina)" },
  { key: "Leda", label: "Leda (feminina)" },
  { key: "Zephyr", label: "Zephyr (feminina)" },
  { key: "Charon", label: "Charon (masculina)" },
  { key: "Fenrir", label: "Fenrir (masculina)" },
  { key: "Orus", label: "Orus (masculina)" },
  { key: "Puck", label: "Puck (masculina)" },
] as const;

export const DEFAULT_SPEECH_VOICE = "Kore";

export function isSpeechVoice(value: string): boolean {
  return SPEECH_VOICES.some((voice) => voice.key === value);
}

// Normaliza espaços para que reformatar o texto (quebra de linha a mais) não gere áudio de novo.
export function normalizeSpeechText(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function speechTextHash(input: { model: string; voice: string; languageCode: string; text: string }): string {
  return createHash("sha256")
    .update([input.model, input.voice, input.languageCode, input.text].join("\u0000"))
    .digest("hex");
}

export function countCharacters(text: string): number {
  return [...text].length;
}

export function currentUsageMonth(now: Date = new Date()): string {
  return now.toISOString().slice(0, 7);
}
