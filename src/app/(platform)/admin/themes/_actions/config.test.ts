import { beforeEach, describe, expect, it, vi } from "vitest";

// O teste global de server actions não enxerga escrita de cookie (spec §7.2) — aqui sim.
const jar = new Map<string, { value: string; options?: unknown }>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    set: (name: string, value: string, options: unknown) => void jar.set(name, { value, options }),
    delete: (name: string) => void jar.delete(name),
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
const composer = {
  saveThemeConfigDraft: vi.fn(),
  issueDraftPreviewToken: vi.fn(),
  publishThemeConfigDraft: vi.fn(),
  discardThemeConfigDraft: vi.fn(),
  rollbackThemeConfigRevision: vi.fn(),
  importThemeConfigFile: vi.fn(),
};
vi.mock("@/platform/theme-engine/theme-config", () => composer);

const actions = await import("./config");
const COOKIE = "venore-theme-preview";
const initial = { error: null, warnings: [], done: false };
const denied = { success: false, error: { code: "rbac.authorization.unauthenticated", message: "Entre primeiro." } };

beforeEach(() => {
  jar.clear();
  for (const fn of Object.values(composer)) fn.mockReset();
});

describe("cookie de preview nas actions de config", () => {
  it("startThemePreviewAction: sem autorização, nenhum cookie", async () => {
    composer.issueDraftPreviewToken.mockResolvedValueOnce(denied);
    expect(await actions.startThemePreviewAction()).toEqual({ error: "Entre primeiro.", warnings: [], done: false });
    expect(jar.has(COOKIE)).toBe(false);
  });

  it("startThemePreviewAction: autorizado, grava o token com as opções seguras", async () => {
    composer.issueDraftPreviewToken.mockResolvedValueOnce({ success: true, data: { token: "tok" } });
    await actions.startThemePreviewAction();
    expect(jar.get(COOKIE)).toEqual({ value: "tok", options: expect.objectContaining({ httpOnly: true, sameSite: "lax", maxAge: 7200 }) });
  });

  it("saveThemeDraftAction: salvar falhou ⇒ nem cookie nem preview", async () => {
    composer.saveThemeConfigDraft.mockResolvedValueOnce(denied);
    const formData = new FormData();
    formData.set("config", "{}");
    expect((await actions.saveThemeDraftAction(initial, formData)).error).toBe("Entre primeiro.");
    expect(composer.issueDraftPreviewToken).not.toHaveBeenCalled();
    expect(jar.has(COOKIE)).toBe(false);
  });

  it("saveThemeDraftAction: salvo ⇒ liga o preview do rascunho e devolve os avisos", async () => {
    composer.saveThemeConfigDraft.mockResolvedValueOnce({ success: true, data: { draft: {}, warnings: ["w"] } });
    composer.issueDraftPreviewToken.mockResolvedValueOnce({ success: true, data: { token: "tok" } });
    const formData = new FormData();
    formData.set("config", JSON.stringify({ a: 1 }));
    expect(await actions.saveThemeDraftAction(initial, formData)).toEqual({ error: null, warnings: ["w"], done: true });
    expect(composer.saveThemeConfigDraft).toHaveBeenCalledWith({ config: { a: 1 }, basedOnRevisionId: undefined });
    expect(jar.get(COOKIE)?.value).toBe("tok");
  });

  it("publicar/descartar com sucesso saem do preview; com falha, o cookie fica", async () => {
    jar.set(COOKIE, { value: "tok" });
    composer.publishThemeConfigDraft.mockResolvedValueOnce(denied);
    await actions.publishThemeDraftAction();
    expect(jar.has(COOKIE)).toBe(true);
    composer.publishThemeConfigDraft.mockResolvedValueOnce({ success: true, data: { draft: {}, warnings: [] } });
    await actions.publishThemeDraftAction();
    expect(jar.has(COOKIE)).toBe(false);

    jar.set(COOKIE, { value: "tok" });
    composer.discardThemeConfigDraft.mockResolvedValueOnce({ success: true, data: { discarded: true } });
    await actions.discardThemeDraftAction();
    expect(jar.has(COOKIE)).toBe(false);
  });

  it("stopThemePreviewAction só apaga o cookie", async () => {
    jar.set(COOKIE, { value: "tok" });
    await actions.stopThemePreviewAction();
    expect(jar.has(COOKIE)).toBe(false);
  });

  it("importThemeConfigAction repassa o arquivo e os avisos (só rascunho, quem decide é o composer)", async () => {
    composer.importThemeConfigFile.mockResolvedValueOnce({ success: true, data: { draft: {}, warnings: ["x"] } });
    const formData = new FormData();
    const file = new File(["{}"], "a.json");
    formData.set("file", file);
    expect(await actions.importThemeConfigAction(initial, formData)).toEqual({ error: null, warnings: ["x"], done: true });
    expect(composer.publishThemeConfigDraft).not.toHaveBeenCalled();
  });
});
