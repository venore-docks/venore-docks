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
});
