import { describe, expect, it, vi } from "vitest";
import type { ThemeConfigDocument, ThemePaletteChoice } from "../../../contracts/v8/config-document";
import { buildPublishedSettingEntries } from "./published-settings";

const doc = (palette: ThemePaletteChoice): ThemeConfigDocument => ({
  schemaVersion: 1,
  themeKey: "nite",
  byTheme: { nite: { palette, options: { density: "compact" }, fonts: {} }, aurora: { palette: { mode: "default" }, options: {}, fonts: {} } },
  assets: {},
  sections: [],
});

describe("dual-write das chaves legadas na publicação (spec §4.1/§13)", () => {
  it("theme.config primeiro, com revisionId/publishedAt no topo; depois theme.active", () => {
    const entries = buildPublishedSettingEntries(doc({ mode: "default" }), "r1", "2026-10-01T00:00:00.000Z");
    expect(entries[0]).toEqual({ key: "theme.config", value: { ...doc({ mode: "default" }), revisionId: "r1", publishedAt: "2026-10-01T00:00:00.000Z" } });
    expect(entries.slice(1)).toEqual([
      { key: "theme.active", value: "nite" },
      { key: "theme.activePaletteId", value: "default" },
    ]);
  });

  it("preset vira o id do preset", () => {
    expect(buildPublishedSettingEntries(doc({ mode: "preset", presetId: "ember" }), "r", "t").slice(1)).toEqual([
      { key: "theme.active", value: "nite" },
      { key: "theme.activePaletteId", value: "ember" },
    ]);
  });

  it("custom grava 'custom' + theme.customColorPalette.<tema>", () => {
    const entries = buildPublishedSettingEntries(doc({ mode: "custom", light: { primary: "#112233" }, dark: { primary: "#445566" } }), "r", "t");
    expect(entries.slice(2)).toEqual([
      { key: "theme.activePaletteId", value: "custom" },
      { key: "theme.customColorPalette.nite", value: { light: { primary: "#112233" }, dark: { primary: "#445566" } } },
    ]);
  });

  it("seed (que o 7.x não conhece) vira a personalizada com as cores geradas", () => {
    const entries = buildPublishedSettingEntries(
      doc({ mode: "seed", seed: "#336699", generated: { light: { primary: "#336699" }, dark: { primary: "#6699cc" } } }),
      "r",
      "t",
    );
    expect(entries.slice(2)).toEqual([
      { key: "theme.activePaletteId", value: "custom" },
      { key: "theme.customColorPalette.nite", value: { light: { primary: "#336699" }, dark: { primary: "#6699cc" } } },
    ]);
  });

  it("o valor de theme.config volta pelo read path como o mesmo documento", async () => {
    const { parseThemeConfigDocument } = await import("../../../contracts/v8/config-document");
    const value = buildPublishedSettingEntries(doc({ mode: "default" }), "r1", "t")[0].value as Record<string, unknown>;
    const { revisionId, publishedAt, ...document } = value;
    expect([revisionId, publishedAt]).toEqual(["r1", "t"]);
    expect(parseThemeConfigDocument(document)).toEqual(doc({ mode: "default" }));
  });
});

describe("revert de publicação: chave ausente volta como false", () => {
  it("o read path trata theme.config=false como ausente (síntese legada)", async () => {
    vi.resetModules();
    vi.doMock("@/contexts/settings", () => ({
      getSetting: async ({ key }: { key: string }) => ({
        success: true,
        data: key === "theme.config" ? { key, value: false, updatedAt: new Date() } : key === "theme.active" ? { key, value: false, updatedAt: new Date() } : null,
      }),
    }));
    const { getPublishedThemeConfig } = await import("../get-published-theme-config/service");
    const result = await getPublishedThemeConfig();
    expect(result.success && result.data).toMatchObject({ source: "legacy-synthesis", themeKey: "venore-slime" });
    vi.doUnmock("@/contexts/settings");
  });
});
