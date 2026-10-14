import { describe, expect, it } from "vitest";
import { createSpeechPort } from "./index";

describe("createSpeechPort", () => {
  it("sem GOOGLE_TTS_API_KEY fica desligado", () => {
    expect(createSpeechPort({}).isEnabled()).toBe(false);
    expect(createSpeechPort({ GOOGLE_TTS_API_KEY: "  " }).isEnabled()).toBe(false);
  });

  it("com a chave usa o Google (Chirp 3 HD)", () => {
    const port = createSpeechPort({ GOOGLE_TTS_API_KEY: "k" });
    expect(port.isEnabled()).toBe(true);
    expect(port.model).toBe("google-chirp3-hd");
  });

  it("SPEECH_DRIVER=worker usa o worker externo, e só com CRON_SECRET", () => {
    const port = createSpeechPort({ SPEECH_DRIVER: "worker", CRON_SECRET: "s" });
    expect(port.kind).toBe("worker");
    expect(port.voices.map((voice) => voice.key)).toEqual(["female", "male"]);
    expect(createSpeechPort({ SPEECH_DRIVER: "worker" }).isEnabled()).toBe(false);
  });

  it("SPEECH_DRIVER=google sem chave fica desligado; driver desconhecido também", () => {
    expect(createSpeechPort({ SPEECH_DRIVER: "google" }).isEnabled()).toBe(false);
    expect(createSpeechPort({ SPEECH_DRIVER: "azure", GOOGLE_TTS_API_KEY: "k" }).isEnabled()).toBe(false);
  });
});
