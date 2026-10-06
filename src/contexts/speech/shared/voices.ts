import { speechPort, type SpeechVoiceOption } from "@/infrastructure/speech";

// Catálogo de vozes do driver ativo (Google: nomes Chirp 3 HD; worker: feminina/masculina).
export function speechVoices(): readonly SpeechVoiceOption[] {
  return speechPort.voices;
}

export function isSpeechVoice(value: string): boolean {
  return speechPort.voices.some((voice) => voice.key === value);
}

export function defaultSpeechVoice(): string {
  return speechPort.defaultVoice;
}
