import { describe, expect, it } from "vitest";
import { currentUsageMonth, normalizeSpeechText, speechLanguageCode, speechTextHash } from "./language";

describe("speechLanguageCode", () => {
  it("mapeia locale sem região para a variante padrão e preserva a região quando vem", () => {
    expect(speechLanguageCode("pt-BR")).toBe("pt-BR");
    expect(speechLanguageCode("en")).toBe("en-US");
    expect(speechLanguageCode("es")).toBe("es-ES");
    expect(speechLanguageCode("ja")).toBe("ja-JP");
    expect(speechLanguageCode("en-gb")).toBe("en-GB");
  });

  it("locale sem voz não ganha áudio", () => {
    expect(speechLanguageCode("xx")).toBeNull();
    expect(speechLanguageCode("")).toBeNull();
  });
});

describe("hash e normalização", () => {
  it("reformatar espaços não muda o hash; trocar voz muda", () => {
    const base = { model: "m", voice: "Kore", languageCode: "pt-BR" };
    const a = speechTextHash({ ...base, text: normalizeSpeechText("Olá,   mundo.\r\n\r\n\r\nFim") });
    const b = speechTextHash({ ...base, text: normalizeSpeechText("Olá, mundo.\n\nFim") });
    expect(a).toBe(b);
    expect(speechTextHash({ ...base, voice: "Puck", text: "Olá, mundo.\n\nFim" })).not.toBe(b);
  });

  it("mês de uso é UTC", () => {
    expect(currentUsageMonth(new Date("2026-10-31T23:30:00-03:00"))).toBe("2026-11");
  });
});
