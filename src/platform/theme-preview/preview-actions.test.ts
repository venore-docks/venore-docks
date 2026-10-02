import { beforeEach, describe, expect, it, vi } from "vitest";

const jar = new Map<string, string>();
vi.mock("next/headers", () => ({ cookies: async () => ({ delete: (name: string) => void jar.delete(name) }) }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
const publishThemeConfigDraft = vi.fn();
const discardThemeConfigDraft = vi.fn();
vi.mock("@/platform/theme-engine/theme-config", () => ({
  publishThemeConfigDraft: () => publishThemeConfigDraft(),
  discardThemeConfigDraft: () => discardThemeConfigDraft(),
}));

const actions = await import("./preview-actions");

beforeEach(() => jar.set("venore-theme-preview", "tok"));

describe("ações da faixa de preview", () => {
  it("sair apaga o cookie", async () => {
    expect(await actions.exitThemePreviewAction()).toEqual({ error: null });
    expect(jar.size).toBe(0);
  });

  it("publicar sem autorização: erro e o preview continua", async () => {
    publishThemeConfigDraft.mockResolvedValueOnce({ success: false, error: { code: "rbac.authorization.forbidden", message: "não" } });
    expect(await actions.publishPreviewDraftAction()).toEqual({ error: "não" });
    expect(jar.size).toBe(1);
  });

  it("descartar com sucesso sai do preview", async () => {
    discardThemeConfigDraft.mockResolvedValueOnce({ success: true, data: { discarded: true } });
    expect(await actions.discardPreviewDraftAction()).toEqual({ error: null });
    expect(jar.size).toBe(0);
  });
});
