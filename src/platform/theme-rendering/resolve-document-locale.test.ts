import { beforeEach, describe, expect, it, vi } from "vitest";

const settings = new Map<string, unknown>();
let failing = false;
vi.mock("@/contexts/settings", () => ({
  CORE_SETTING_DEFAULTS: { "platform.locale": "pt-BR", "platform.textDirection": "auto" },
  getSetting: async ({ key }: { key: string }) => {
    if (failing) throw new Error("db down");
    return settings.has(key) ? { success: true, data: { key, value: settings.get(key) } } : { success: true, data: null };
  },
}));
vi.mock("react", async (importOriginal) => ({ ...(await importOriginal<typeof import("react")>()), cache: <T,>(fn: T) => fn }));

const { resolveDocumentLocale } = await import("./resolve-document-locale");

describe("resolveDocumentLocale", () => {
  beforeEach(() => {
    settings.clear();
    failing = false;
  });

  it("sem setting: pt-BR/ltr, o <html> de antes da v8", async () => {
    expect(await resolveDocumentLocale()).toEqual({ locale: "pt-BR", dir: "ltr" });
  });

  it("ar dá dir=rtl no automático", async () => {
    settings.set("platform.locale", "ar");
    expect(await resolveDocumentLocale()).toEqual({ locale: "ar", dir: "rtl" });
  });

  it("direção explícita vence o idioma", async () => {
    settings.set("platform.locale", "ar");
    settings.set("platform.textDirection", "ltr");
    expect(await resolveDocumentLocale()).toEqual({ locale: "ar", dir: "ltr" });
  });

  it("valor salvo inválido ou erro de leitura = padrão", async () => {
    settings.set("platform.locale", "@@@");
    expect(await resolveDocumentLocale()).toEqual({ locale: "pt-BR", dir: "ltr" });
    failing = true;
    expect(await resolveDocumentLocale()).toEqual({ locale: "pt-BR", dir: "ltr" });
  });
});
