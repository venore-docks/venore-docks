import { describe, expect, it } from "vitest";
import type { ResolvedThemeDefinition, ThemeMessages } from "@/contexts/themes/contracts/v8";
import { KIT_MESSAGES_AR } from "@/theme-sdk/kit/i18n/messages/ar";
import { KIT_MESSAGES_EN } from "@/theme-sdk/kit/i18n/messages/en";
import { KIT_MESSAGES_PT_BR } from "@/theme-sdk/kit/i18n/messages/pt-BR";
import { t } from "@/theme-sdk/kit/i18n/t";
import { resolveThemeStrings } from "./resolve-theme-strings";

const theme = (messages: ThemeMessages = {}) => ({ key: "demo", messages }) as unknown as ResolvedThemeDefinition;

describe("resolveThemeStrings", () => {
  it("pt-BR sem mensagens do tema = catálogo pt-BR do kit (texto de hoje)", () => {
    expect(resolveThemeStrings(theme(), "pt-BR")).toEqual(KIT_MESSAGES_PT_BR);
  });

  it("locale → idioma → pt-BR → chave", () => {
    const messages: ThemeMessages = { "en-GB": { "custom.greeting": "Cheerio" }, "pt-BR": { "custom.only-pt": "Só pt" } };
    const strings = resolveThemeStrings(theme(messages), "en-GB");
    expect(strings["custom.greeting"]).toBe("Cheerio");
    expect(strings["header.signIn"]).toBe(KIT_MESSAGES_EN["header.signIn"]);
    expect(strings["custom.only-pt"]).toBe("Só pt");
    expect(t(strings, "custom.missing")).toBe("custom.missing");
  });

  it("locale sem catálogo cai no pt-BR do kit", () => {
    expect(resolveThemeStrings(theme(), "de-DE")["header.signIn"]).toBe("Entrar");
  });

  it("strings do tema sobrescrevem as do kit", () => {
    const strings = resolveThemeStrings(theme({ "pt-BR": { "header.signIn": "Acessar" }, ar: { "footer.signIn": "دخول" } }), "ar");
    expect(strings["footer.signIn"]).toBe("دخول");
    expect(strings["header.signIn"]).toBe(KIT_MESSAGES_AR["header.signIn"]);
    expect(resolveThemeStrings(theme({ "pt-BR": { "header.signIn": "Acessar" } }), "pt-BR")["header.signIn"]).toBe("Acessar");
  });

  it("memoiza por definição + locale", () => {
    const definition = theme();
    expect(resolveThemeStrings(definition, "es")).toBe(resolveThemeStrings(definition, "es"));
  });
});
