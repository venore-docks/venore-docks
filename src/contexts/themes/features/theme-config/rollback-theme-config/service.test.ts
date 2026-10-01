import { beforeEach, describe, expect, it, vi } from "vitest";

const TARGET = "0b8f9c1e-2f7a-4f6e-9a39-1d2c3b4a5f60";
const NEW_REVISION = "2b8f9c1e-2f7a-4f6e-9a39-1d2c3b4a5f62";
const archivedConfig = { schemaVersion: 1, themeKey: "aurora", byTheme: {}, assets: {}, sections: [] };
let targetRow: Record<string, unknown> | null;

const findRevisionRow = vi.fn(async () => ({ success: true, data: targetRow }));
const saveThemeDraft = vi.fn(async (command: { config: unknown }) => ({ success: true, data: { id: NEW_REVISION, status: "draft", config: command.config } }));
const publishThemeDraft = vi.fn<(command: unknown) => Promise<unknown>>(async () => ({ success: true, data: { id: NEW_REVISION, status: "published", config: archivedConfig } }));

vi.mock("./store", () => ({ findRevisionRow: () => findRevisionRow() }));
vi.mock("../save-theme-draft/service", () => ({ saveThemeDraft: (command: { config: unknown }) => saveThemeDraft(command) }));
vi.mock("../publish-theme-draft/service", () => ({ publishThemeDraft: (command: unknown) => publishThemeDraft(command) }));

const { rollbackThemeConfig } = await import("./service");

const row = (status: string) => ({
  id: TARGET,
  status,
  config: archivedConfig,
  basedOnRevisionId: null,
  note: null,
  createdBy: "u0",
  createdAt: new Date("2026-09-01T00:00:00Z"),
  publishedBy: "u0",
  publishedAt: new Date("2026-09-02T00:00:00Z"),
});

beforeEach(() => {
  saveThemeDraft.mockClear();
  publishThemeDraft.mockClear();
  targetRow = row("archived");
});

describe("rollbackThemeConfig (spec §4.3)", () => {
  it("copia a config arquivada para o rascunho e publica — o resultado é uma revisão NOVA", async () => {
    const result = await rollbackThemeConfig({ revisionId: TARGET, actorId: "u1" });
    expect(saveThemeDraft).toHaveBeenCalledWith(expect.objectContaining({ config: archivedConfig, basedOnRevisionId: TARGET, actorId: "u1" }));
    expect(publishThemeDraft).toHaveBeenCalledWith({
      actorId: "u1",
      audit: { action: "themes.config.rollback", detail: { rolledBackTo: TARGET } },
    });
    expect(result.success && result.data.id).toBe(NEW_REVISION);
    expect(result.success && result.data.id).not.toBe(TARGET);
  });

  it("revisão inexistente ou rascunho: não encontrada, nada gravado", async () => {
    for (const value of [null, row("draft")]) {
      targetRow = value;
      expect(await rollbackThemeConfig({ revisionId: TARGET, actorId: "u1" })).toMatchObject({
        success: false,
        error: { code: "themes.config.revision_not_found" },
      });
    }
    expect(saveThemeDraft).not.toHaveBeenCalled();
  });

  it("a revisão já publicada não é 'restaurada' de novo", async () => {
    targetRow = row("published");
    expect(await rollbackThemeConfig({ revisionId: TARGET, actorId: "u1" })).toMatchObject({
      success: false,
      error: { code: "themes.config.rollback_current" },
    });
    expect(publishThemeDraft).not.toHaveBeenCalled();
  });

  it("falha ao salvar o rascunho: não publica", async () => {
    saveThemeDraft.mockResolvedValueOnce({ success: false, error: { code: "themes.config.storage_unavailable", message: "x" } } as never);
    expect((await rollbackThemeConfig({ revisionId: TARGET, actorId: "u1" })).success).toBe(false);
    expect(publishThemeDraft).not.toHaveBeenCalled();
  });
});
