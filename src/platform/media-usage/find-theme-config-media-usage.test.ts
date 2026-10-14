import { describe, expect, it, vi } from "vitest";
import type { ThemeConfigDocument } from "@/contexts/themes/contracts/v8";

const published: ThemeConfigDocument = {
  schemaVersion: 1,
  themeKey: "venore-slime",
  byTheme: { "venore-slime": { palette: { mode: "default" }, options: { hero: "m-1" }, fonts: {} } },
  assets: { ogImageMediaId: "m-1", iconMediaId: "m-2" },
  sections: [],
};
const draftConfig: ThemeConfigDocument = { ...published, byTheme: {}, assets: { iconMediaId: "m-3" } };
let draftAuthorized = true;

vi.mock("@/contexts/themes", () => ({
  getPublishedThemeConfig: async () => ({ success: true, data: { ...published, revisionId: null, publishedAt: null, source: "settings" } }),
  getThemeDraft: async () =>
    draftAuthorized ? { success: true, data: { id: "r", config: draftConfig } } : { success: false, error: { code: "rbac.forbidden", message: "x" } },
}));

const { findThemeConfigMediaUsage } = await import("./find-theme-config-media-usage");

describe("findThemeConfigMediaUsage", () => {
  it("lista assets e opções de mídia do tema publicado", async () => {
    const references = await findThemeConfigMediaUsage("m-1");
    expect(references.map((ref) => ref.label)).toEqual([
      "Imagem de compartilhamento (Open Graph) (publicado)",
      'Opção "hero" do tema venore-slime (publicado)',
    ]);
    expect(references.every((ref) => ref.consumerKey === "themes" && ref.href === "/admin/themes/customize")).toBe(true);
  });

  it("inclui o rascunho quando quem consulta pode vê-lo", async () => {
    expect((await findThemeConfigMediaUsage("m-3")).map((ref) => ref.label)).toEqual(["Ícone do site (rascunho)"]);
    draftAuthorized = false;
    expect(await findThemeConfigMediaUsage("m-3")).toEqual([]);
  });

  it("está registrado nos providers do core", async () => {
    const source = await import("node:fs").then((fs) => fs.readFileSync(new URL("./media-usage-registry.ts", import.meta.url), "utf8"));
    expect(source).toMatch(/themes: findThemeConfigMediaUsage/);
  });
});
