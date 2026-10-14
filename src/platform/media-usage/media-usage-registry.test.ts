import { beforeEach, describe, expect, it, vi } from "vitest";

const findCmsMediaUsage = vi.fn();
const findBrandMediaUsage = vi.fn();
const findAcademyMediaUsage = vi.fn();
const findThemeConfigMediaUsage = vi.fn();
const findSpeechMediaUsageReferences = vi.fn();
const registerPlugins = vi.fn();

vi.mock("@/contexts/cms", () => ({
  findCmsMediaUsage: (...args: unknown[]) => findCmsMediaUsage(...args),
}));

vi.mock("../brand/find-brand-media-usage", () => ({
  findBrandMediaUsage: (...args: unknown[]) => findBrandMediaUsage(...args),
}));

vi.mock("./find-theme-config-media-usage", () => ({
  findThemeConfigMediaUsage: (...args: unknown[]) => findThemeConfigMediaUsage(...args),
}));

vi.mock("./find-speech-media-usage", () => ({
  findSpeechMediaUsageReferences: (...args: unknown[]) => findSpeechMediaUsageReferences(...args),
}));

// O resolver de uso de mídia do plugin vem de PLUGIN_CONTRIBUTIONS agora (campo mediaUsageResolver).
vi.mock("@/plugins/contributions", () => ({
  PLUGIN_CONTRIBUTIONS: {
    academy: { mediaUsageResolver: (...args: unknown[]) => findAcademyMediaUsage(...args) },
  },
}));

vi.mock("../plugin-engine/register-plugins", () => ({
  registerPlugins: (...args: unknown[]) => registerPlugins(...args),
  getPluginRegistrationReport: (...args: unknown[]) => registerPlugins(...args),
}));

describe("collectMediaUsage", () => {
  beforeEach(() => {
    findCmsMediaUsage.mockReset().mockResolvedValue([]);
    findBrandMediaUsage.mockReset().mockResolvedValue([]);
    findAcademyMediaUsage.mockReset().mockResolvedValue([]);
    findThemeConfigMediaUsage.mockReset().mockResolvedValue([]);
    findSpeechMediaUsageReferences.mockReset().mockResolvedValue([]);
    registerPlugins.mockReset();
  });

  it("aggregates references from every core provider plus active plugin providers", async () => {
    registerPlugins.mockResolvedValue({ entries: [{ key: "academy", status: "active", errors: [] }] });
    findCmsMediaUsage.mockResolvedValue([{ consumerKey: "cms", consumerLabel: "CMS", label: "Entry: Home", href: "/x" }]);
    findAcademyMediaUsage.mockResolvedValue([
      { consumerKey: "academy", consumerLabel: "Academy", label: "Curso: X", href: "/y" },
    ]);

    const { collectMediaUsage } = await import("./media-usage-registry");
    const result = await collectMediaUsage("media-1");

    expect(result).toHaveLength(2);
    expect(result.map((reference) => reference.consumerKey).sort()).toEqual(["academy", "cms"]);
  });

  it("excludes a plugin's provider when the plugin is disabled — no phantom usage from a consumer that disappeared", async () => {
    registerPlugins.mockResolvedValue({ entries: [{ key: "academy", status: "disabled", errors: [] }] });
    findAcademyMediaUsage.mockResolvedValue([
      { consumerKey: "academy", consumerLabel: "Academy", label: "Curso: X", href: "/y" },
    ]);

    const { collectMediaUsage } = await import("./media-usage-registry");
    const result = await collectMediaUsage("media-1");

    expect(result).toEqual([]);
    expect(findAcademyMediaUsage).not.toHaveBeenCalled();
  });

  it("returns an empty list when nothing references the media", async () => {
    registerPlugins.mockResolvedValue({ entries: [] });

    const { collectMediaUsage } = await import("./media-usage-registry");
    const result = await collectMediaUsage("media-1");

    expect(result).toEqual([]);
  });

  it("includes theme config assets (OG image, icon) as a core provider", async () => {
    registerPlugins.mockResolvedValue({ entries: [] });
    findThemeConfigMediaUsage.mockResolvedValue([
      { consumerKey: "themes", consumerLabel: "Tema", label: "Ícone do site (publicado)", href: "/admin/themes/customize" },
    ]);
    const { collectMediaUsage } = await import("./media-usage-registry");
    expect((await collectMediaUsage("m-1")).map((ref) => ref.consumerKey)).toEqual(["themes"]);
    expect(findThemeConfigMediaUsage).toHaveBeenCalledWith("m-1");
  });

  it("inclui o MP3 da leitura em voz alta como provider do core", async () => {
    registerPlugins.mockResolvedValue({ entries: [] });
    findSpeechMediaUsageReferences.mockResolvedValue([
      { consumerKey: "speech", consumerLabel: "Leitura em voz alta", label: "Áudio da entry (pt-BR)", href: "/admin/cms/entries/e-1" },
    ]);
    const { collectMediaUsage } = await import("./media-usage-registry");
    expect((await collectMediaUsage("m-1")).map((ref) => ref.consumerKey)).toEqual(["speech"]);
    expect(findSpeechMediaUsageReferences).toHaveBeenCalledWith("m-1");
  });
});
