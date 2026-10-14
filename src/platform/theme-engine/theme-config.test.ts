import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const DRAFT_ID = "0b8f9c1e-2f7a-4f6e-9a39-1d2c3b4a5f60";
const authorizeActor = vi.fn();
const themes = {
  getThemeDraft: vi.fn(),
  saveThemeDraft: vi.fn(),
  publishThemeDraft: vi.fn(),
  importThemeConfig: vi.fn(async (input: unknown) => ({ success: true, data: { draft: { id: DRAFT_ID }, warnings: (input as { warnings: string[] }).warnings } })),
  getPublishedThemeConfig: vi.fn(),
  getThemeConfigRevision: vi.fn(),
  rollbackThemeConfig: vi.fn(),
  exportThemeConfig: vi.fn(),
  discardThemeDraft: vi.fn(),
  listThemeConfigHistory: vi.fn(),
};
vi.mock("@/contexts/rbac", () => ({ authorizeActor: (permission: string) => authorizeActor(permission) }));
vi.mock("@/contexts/auth", () => ({ listUsers: async () => ({ success: true, data: [] }) }));
vi.mock("@/contexts/extensions", () => ({ listExtensionStates: async () => ({ success: true, data: {} }) }));
vi.mock("@/contexts/themes", async (importOriginal) => {
  const rules = await importOriginal<typeof import("@/contexts/themes")>();
  return { ...themes, isReservedSectionPrefix: rules.isReservedSectionPrefix, THEME_CONFIG_STORAGE_UNAVAILABLE: "themes.config.storage_unavailable" };
});

const composer = await import("./theme-config");
const { verifyThemeOverride } = await import("@/platform/theme-preview/override-token");

const slimeConfig = { schemaVersion: 1, themeKey: "venore-slime", byTheme: { "venore-slime": { palette: { mode: "default" }, options: { inexistente: 1 }, fonts: {} } }, assets: {}, sections: [] };
const envelope = (config: unknown = slimeConfig) => ({
  format: "venore-theme-config",
  formatVersion: 1,
  exportedAt: "2026-09-01T00:00:00.000Z",
  coreContract: "8.0.0",
  theme: { key: "venore-slime", version: "0.0.1-outro" },
  config,
});
const file = (content: string) => new File([content], "aparencia.json", { type: "application/json" });

beforeEach(() => {
  vi.stubEnv("AUTH_SECRET", "segredo-de-teste");
  authorizeActor.mockReset();
  for (const fn of Object.values(themes)) fn.mockClear();
});
afterEach(() => vi.unstubAllEnvs());

describe("importThemeConfigFile (spec §7.10)", () => {
  it("sem arquivo, vazio, > 256 KB, JSON quebrado ou fora do schema: recusado sem chamar o context", async () => {
    expect((await composer.importThemeConfigFile(null)).success).toBe(false);
    expect(await composer.importThemeConfigFile(file(""))).toMatchObject({ error: { code: "themes.config.import_missing_file" } });
    expect(await composer.importThemeConfigFile(file("x".repeat(256 * 1024 + 1)))).toMatchObject({ error: { code: "themes.config.import_too_large" } });
    expect(await composer.importThemeConfigFile(file("{"))).toMatchObject({ error: { code: "themes.config.import_invalid" } });
    expect(await composer.importThemeConfigFile(file(JSON.stringify({ ...envelope(), extra: 1 })))).toMatchObject({
      error: { code: "themes.config.import_invalid" },
    });
    expect(themes.importThemeConfig).not.toHaveBeenCalled();
  });

  it("tema desconhecido neste site: erro reportado", async () => {
    const result = await composer.importThemeConfigFile(file(JSON.stringify(envelope({ ...slimeConfig, themeKey: "tema-que-nao-existe" }))));
    expect(result).toMatchObject({ success: false, error: { code: "themes.config.unknown_theme" } });
    expect(themes.importThemeConfig).not.toHaveBeenCalled();
  });

  it("válido: só importThemeConfig (rascunho), com opção desconhecida descartada e avisos", async () => {
    const result = await composer.importThemeConfigFile(file(JSON.stringify(envelope())));
    expect(result.success).toBe(true);
    const call = themes.importThemeConfig.mock.calls[0][0] as { envelope: { config: typeof slimeConfig }; warnings: string[] };
    expect(call.envelope.config.byTheme["venore-slime"].options).toEqual({});
    expect(call.warnings.some((warning) => warning.includes("inexistente"))).toBe(true);
    expect(call.warnings.some((warning) => warning.includes("0.0.1-outro"))).toBe(true);
    expect(themes.publishThemeDraft).not.toHaveBeenCalled();
    expect(themes.saveThemeDraft).not.toHaveBeenCalled();
  });
});

describe("publishThemeConfigDraft", () => {
  it("sem rascunho: não publica", async () => {
    themes.getThemeDraft.mockResolvedValueOnce({ success: true, data: null });
    expect(await composer.publishThemeConfigDraft()).toMatchObject({ success: false, error: { code: "themes.config.no_draft" } });
    expect(themes.publishThemeDraft).not.toHaveBeenCalled();
  });

  it("rascunho com tema que sumiu do registro: não publica", async () => {
    themes.getThemeDraft.mockResolvedValueOnce({ success: true, data: { id: DRAFT_ID, config: { ...slimeConfig, themeKey: "sumiu" } } });
    expect(await composer.publishThemeConfigDraft()).toMatchObject({ success: false, error: { code: "themes.config.unknown_theme" } });
    expect(themes.publishThemeDraft).not.toHaveBeenCalled();
  });

  it("rascunho com sobra: limpa o rascunho e publica", async () => {
    themes.getThemeDraft.mockResolvedValueOnce({ success: true, data: { id: DRAFT_ID, config: slimeConfig } });
    themes.saveThemeDraft.mockResolvedValueOnce({ success: true, data: {} });
    themes.publishThemeDraft.mockResolvedValueOnce({ success: true, data: { id: DRAFT_ID } });
    const result = await composer.publishThemeConfigDraft();
    expect(result.success).toBe(true);
    expect(themes.saveThemeDraft).toHaveBeenCalledTimes(1);
    expect(themes.publishThemeDraft).toHaveBeenCalledTimes(1);
  });
});

describe("tokens de override (preview de rascunho e safe mode)", () => {
  it("sem settings.manage: nenhum token", async () => {
    authorizeActor.mockResolvedValue({ authorized: false, error: { code: "rbac.authorization.forbidden", message: "não" } });
    expect((await composer.issueDraftPreviewToken()).success).toBe(false);
    expect((await composer.issueSafeModeToken()).success).toBe(false);
    expect(authorizeActor).toHaveBeenCalledWith("settings.manage");
    expect(themes.getThemeDraft).not.toHaveBeenCalled();
  });

  it("preview exige rascunho e fica preso ao ator e à revisão", async () => {
    authorizeActor.mockResolvedValue({ authorized: true, actorId: "u1" });
    themes.getThemeDraft.mockResolvedValueOnce({ success: true, data: null });
    expect(await composer.issueDraftPreviewToken()).toMatchObject({ success: false, error: { code: "themes.config.no_draft" } });

    themes.getThemeDraft.mockResolvedValueOnce({ success: true, data: { id: DRAFT_ID } });
    const issued = await composer.issueDraftPreviewToken();
    expect(issued.success && verifyThemeOverride(issued.data.token)).toMatchObject({ kind: "draft", userId: "u1", revisionId: DRAFT_ID });
  });

  it("safe mode fica preso ao ator", async () => {
    authorizeActor.mockResolvedValue({ authorized: true, actorId: "u9" });
    const issued = await composer.issueSafeModeToken();
    expect(issued.success && verifyThemeOverride(issued.data.token)).toMatchObject({ kind: "safe-mode", userId: "u9" });
  });
});
