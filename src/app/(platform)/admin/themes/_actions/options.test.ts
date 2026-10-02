import { beforeEach, describe, expect, it, vi } from "vitest";
import { OPTION_FIELDS } from "@/platform/theme-rendering/theme-options-pipeline.fixture";

vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
const authorizeActor = vi.fn();
vi.mock("@/contexts/rbac", () => ({ authorizeActor: (...a: unknown[]) => authorizeActor(...a) }));
const composer = { loadThemeCustomizeData: vi.fn(), saveThemeConfigDraft: vi.fn() };
vi.mock("@/platform/theme-engine/theme-config", () => composer);

const { saveThemeOptionsAction } = await import("./options");
const initial = { error: null, fieldErrors: {}, warnings: [], done: false };
const doc = {
  schemaVersion: 1,
  themeKey: "aurora",
  byTheme: { aurora: { palette: { mode: "default" }, fonts: {}, options: { layout: "rail", density: "comfortable" } } },
  assets: {},
  sections: [],
};

beforeEach(() => {
  authorizeActor.mockReset();
  composer.loadThemeCustomizeData.mockReset().mockResolvedValue({ success: true, data: { document: doc, draft: { id: "d1" }, theme: { key: "aurora", options: OPTION_FIELDS } } });
  composer.saveThemeConfigDraft.mockReset().mockResolvedValue({ success: true, data: { draft: {}, warnings: [] } });
});

function form(entries: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
}

describe("saveThemeOptionsAction", () => {
  it("sem sessão: recusa antes de ler ou gravar", async () => {
    authorizeActor.mockResolvedValue({ authorized: false, error: { code: "rbac.authorization.unauthenticated", message: "Entre primeiro." } });
    expect(await saveThemeOptionsAction(initial, form({ themeKey: "aurora" }))).toMatchObject({ error: "Entre primeiro.", done: false });
    expect(authorizeActor).toHaveBeenCalledWith("settings.manage");
    expect(composer.loadThemeCustomizeData).not.toHaveBeenCalled();
    expect(composer.saveThemeConfigDraft).not.toHaveBeenCalled();
  });

  it("valor inválido: erro por campo, nada gravado", async () => {
    authorizeActor.mockResolvedValue({ authorized: true });
    const result = await saveThemeOptionsAction(initial, form({ themeKey: "aurora", "option.gap": "7" }));
    expect(result.fieldErrors).toHaveProperty("gap");
    expect(composer.saveThemeConfigDraft).not.toHaveBeenCalled();
  });

  it("grava no rascunho por tema, preservando chaves reservadas", async () => {
    authorizeActor.mockResolvedValue({ authorized: true });
    const result = await saveThemeOptionsAction(initial, form({ themeKey: "aurora", "option.density": "compact", "option.rounded": "true" }));
    expect(result.done).toBe(true);
    const { config, basedOnRevisionId } = composer.saveThemeConfigDraft.mock.calls[0][0];
    expect(basedOnRevisionId).toBe("d1");
    expect(config.byTheme.aurora.options).toMatchObject({ layout: "rail", density: "compact", rounded: true, gap: null });
  });

  it("tema trocado desde que a página abriu ⇒ recusa", async () => {
    authorizeActor.mockResolvedValue({ authorized: true });
    expect((await saveThemeOptionsAction(initial, form({ themeKey: "outro" }))).done).toBe(false);
    expect(composer.saveThemeConfigDraft).not.toHaveBeenCalled();
  });
});
