import { describe, expect, it, vi } from "vitest";

const saveThemeDraft = vi.fn(async (command: { config: unknown }) => ({
  success: true,
  data: { id: "d1", status: "draft", config: command.config },
}));
const recordAuditEvent = vi.fn<(input: unknown) => Promise<void>>(async () => undefined);
vi.mock("../save-theme-draft/service", () => ({ saveThemeDraft: (command: { config: unknown }) => saveThemeDraft(command) }));
vi.mock("@/observability", () => ({ recordAuditEvent: (input: unknown) => recordAuditEvent(input as never) }));
// Nada de publicar nem de settings: se o import tocasse nisso, estes mocks acusariam.
const publishThemeDraft = vi.fn();
const setSetting = vi.fn();
vi.mock("../publish-theme-draft/service", () => ({ publishThemeDraft }));
vi.mock("@/contexts/settings", () => ({ setSetting, getSetting: vi.fn() }));

const { importThemeConfig } = await import("./service");
const config = { schemaVersion: 1 as const, themeKey: "aurora", byTheme: {}, assets: {}, sections: [] };
const envelope = {
  format: "venore-theme-config" as const,
  formatVersion: 1 as const,
  exportedAt: "2026-09-01T00:00:00.000Z",
  coreContract: "8.0.0",
  theme: { key: "aurora", version: "0.2.0" },
  config,
};

describe("importThemeConfig (spec §7.10)", () => {
  it("cria SÓ o rascunho e audita themes.config.import", async () => {
    const result = await importThemeConfig({ envelope, warnings: ["opção x descartada"], actorId: "u1" });
    expect(result).toMatchObject({ success: true, data: { draft: { id: "d1", status: "draft" }, warnings: ["opção x descartada"] } });
    expect(saveThemeDraft).toHaveBeenCalledWith(expect.objectContaining({ config, actorId: "u1" }));
    expect(publishThemeDraft).not.toHaveBeenCalled();
    expect(setSetting).not.toHaveBeenCalled();
    expect(recordAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "themes.config.import", outcome: "success", detail: expect.objectContaining({ revisionId: "d1" }) }),
    );
  });
});
