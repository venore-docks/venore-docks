import { describe, expect, it } from "vitest";
import { KIT_MESSAGES, localeFallbackChain, mergeLocaleStrings } from "./catalogs";
import { KIT_MESSAGES_AR } from "./messages/ar";
import { KIT_MESSAGES_EN } from "./messages/en";
import { KIT_MESSAGES_ES } from "./messages/es";
import { KIT_MESSAGES_PT_BR } from "./messages/pt-BR";
import { t } from "./t";

describe("catálogos do kit", () => {
  it("en/es/ar têm exatamente as chaves do pt-BR, sem texto vazio", () => {
    const keys = Object.keys(KIT_MESSAGES_PT_BR).sort();
    for (const catalog of [KIT_MESSAGES_EN, KIT_MESSAGES_ES, KIT_MESSAGES_AR]) {
      expect(Object.keys(catalog).sort()).toEqual(keys);
      expect(Object.values(catalog).every((value) => value.trim().length > 0)).toBe(true);
    }
  });

  it("absorveu as chaves das regiões (W3) e dos templates (W4) com o texto de hoje", () => {
    expect(KIT_MESSAGES_PT_BR["header.navLabel"]).toBe("Menu do cabeçalho");
    expect(KIT_MESSAGES_PT_BR["contextual.mobileSummary"]).toBe("Nesta seção");
    expect(KIT_MESSAGES_PT_BR["login.subtitle"]).toBe("Acesse com uma das opções abaixo.");
    expect(KIT_MESSAGES_PT_BR["maintenance.message"]).toBe("O site volta em instantes.");
  });
});

describe("localeFallbackChain", () => {
  it("locale → idioma → pt-BR, sem repetição", () => {
    expect(localeFallbackChain("en-US")).toEqual(["en-US", "en", "pt-BR"]);
    expect(localeFallbackChain("ar")).toEqual(["ar", "pt-BR"]);
    expect(localeFallbackChain("pt-BR")).toEqual(["pt-BR", "pt"]);
  });
});

describe("mergeLocaleStrings", () => {
  const kit = { "pt-BR": { a: "a-pt", b: "b-pt", c: "c-pt" }, en: { a: "a-en", b: "b-en" }, "en-GB": { a: "a-gb" } };

  it("cai do locale para o idioma, depois para o pt-BR, depois para a chave", () => {
    const strings = mergeLocaleStrings("en-GB", kit, {});
    expect(strings.a).toBe("a-gb");
    expect(strings.b).toBe("b-en");
    expect(strings.c).toBe("c-pt");
    expect(t(strings, "zzz")).toBe("zzz");
  });

  it("mensagem do tema vence a do kit no mesmo degrau, mas não um degrau mais específico", () => {
    const strings = mergeLocaleStrings("en-GB", kit, { en: { a: "theme-a-en", b: "theme-b-en" }, "pt-BR": { c: "theme-c-pt" } });
    expect(strings.a).toBe("a-gb");
    expect(strings.b).toBe("theme-b-en");
    expect(strings.c).toBe("theme-c-pt");
  });

  it("casa locale sem diferenciar maiúsculas e ignora valor que não é string", () => {
    const strings = mergeLocaleStrings("pt-BR", kit, { "pt-br": { a: "x", b: 1 as unknown as string } });
    expect(strings.a).toBe("x");
    expect(strings.b).toBe("b-pt");
  });

  it("ar usa o catálogo árabe do kit", () => {
    expect(mergeLocaleStrings("ar-EG", KIT_MESSAGES, {})["header.signIn"]).toBe(KIT_MESSAGES_AR["header.signIn"]);
  });
});
