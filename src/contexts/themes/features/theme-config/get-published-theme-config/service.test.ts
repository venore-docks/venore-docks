import { beforeEach, describe, expect, it, vi } from "vitest";

const settings = new Map<string, unknown>();
let failingKeys = new Set<string>();

vi.mock("@/contexts/settings", () => ({
  getSetting: async ({ key }: { key: string }) => {
    if (failingKeys.has(key)) return { success: false, error: { code: "db", message: "down" } };
    return { success: true, data: settings.has(key) ? { key, value: settings.get(key), updatedAt: new Date() } : null };
  },
}));

const validDocument = {
  schemaVersion: 1,
  themeKey: "aurora",
  byTheme: { aurora: { palette: { mode: "preset", presetId: "ocean" }, options: { density: "compact" }, fonts: {} } },
  assets: {},
  sections: [],
};

beforeEach(async () => {
  settings.clear();
  failingKeys = new Set();
  const { clearLastKnownGood } = await import("./store");
  clearLastKnownGood();
});

describe("getPublishedThemeConfig — degraus de fallback (spec §4.1)", () => {
  it("1. theme.config válido vem do settings, com metadado de publicação", async () => {
    settings.set("theme.config", { ...validDocument, revisionId: "r1", publishedAt: "2026-09-01T00:00:00.000Z" });
    const { getPublishedThemeConfig } = await import("./service");
    const result = await getPublishedThemeConfig();
    expect(result).toEqual({
      success: true,
      data: { ...validDocument, revisionId: "r1", publishedAt: "2026-09-01T00:00:00.000Z", source: "settings" },
    });
  });

  it("2a. sem theme.config e sem chaves legadas: slime com paleta padrão (= hoje)", async () => {
    const { getPublishedThemeConfig } = await import("./service");
    const result = await getPublishedThemeConfig();
    expect(result.success && result.data).toMatchObject({
      themeKey: "venore-slime",
      source: "legacy-synthesis",
      byTheme: { "venore-slime": { palette: { mode: "default" }, options: {}, fonts: {} } },
      sections: [],
    });
  });

  it("2b. síntese legada: tema ativo + preset", async () => {
    settings.set("theme.active", "nite");
    settings.set("theme.activePaletteId", "ember");
    const { getPublishedThemeConfig } = await import("./service");
    const result = await getPublishedThemeConfig();
    expect(result.success && result.data.byTheme.nite.palette).toEqual({ mode: "preset", presetId: "ember" });
    expect(result.success && result.data.themeKey).toBe("nite");
  });

  it("2c. síntese legada: paleta personalizada do tema", async () => {
    settings.set("theme.active", "nite");
    settings.set("theme.activePaletteId", "custom");
    settings.set("theme.customColorPalette.nite", { light: { primary: "#112233" }, dark: {} });
    const { getPublishedThemeConfig } = await import("./service");
    const result = await getPublishedThemeConfig();
    expect(result.success && result.data.byTheme.nite.palette).toEqual({ mode: "custom", light: { primary: "#112233" }, dark: {} });
  });

  it("2d. theme.config inválido conta como ausente", async () => {
    settings.set("theme.config", { ...validDocument, extra: true });
    settings.set("theme.active", "nite");
    const { getPublishedThemeConfig } = await import("./service");
    const result = await getPublishedThemeConfig();
    expect(result.success && result.data.source).toBe("legacy-synthesis");
    expect(result.success && result.data.themeKey).toBe("nite");
  });

  it("3. leitura falha: devolve o last-known-good do processo", async () => {
    settings.set("theme.config", validDocument);
    const { getPublishedThemeConfig } = await import("./service");
    await getPublishedThemeConfig();
    failingKeys = new Set(["theme.config"]);
    const result = await getPublishedThemeConfig();
    expect(result.success && result.data.source).toBe("last-known-good");
    expect(result.success && result.data.themeKey).toBe("aurora");
  });

  it("4. leitura falha sem last-known-good: erro (o render usa o slime padrão)", async () => {
    failingKeys = new Set(["theme.config"]);
    const { getPublishedThemeConfig } = await import("./service");
    const result = await getPublishedThemeConfig();
    expect(result).toEqual({ success: false, error: { code: "themes.config.read_failed", message: "down" } });
  });
});
