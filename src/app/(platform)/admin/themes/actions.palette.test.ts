import { beforeEach, describe, expect, it, vi } from "vitest";

const authorizeActor = vi.fn();
vi.mock("@/contexts/rbac", () => ({ authorizeActor: (...args: unknown[]) => authorizeActor(...args) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/contexts/settings", () => ({ getSetting: vi.fn(), setSetting: vi.fn() }));

const { checkPaletteContrastAction, generateSeedPaletteAction } = await import("./actions");

// Actions do painel de paleta (W1): só cálculo, mas exigem settings.manage.
describe("actions do painel de paleta", () => {
  beforeEach(() => authorizeActor.mockReset());

  it("sem settings.manage: recusa sem calcular nada", async () => {
    authorizeActor.mockResolvedValue({ authorized: false, error: { code: "rbac.forbidden", message: "Sem permissão." } });
    expect(await generateSeedPaletteAction("venore-slime", "#3366cc")).toEqual({ data: null, error: "Sem permissão." });
    expect(await checkPaletteContrastAction("venore-slime", { mode: "default" })).toEqual({ data: null, error: "Sem permissão." });
    expect(authorizeActor).toHaveBeenCalledWith("settings.manage");
  });

  describe("com settings.manage", () => {
    beforeEach(() => authorizeActor.mockResolvedValue({ authorized: true, actor: { userId: "u1" } }));

    it("tema desconhecido = erro (sem cair no slime calado)", async () => {
      expect(await generateSeedPaletteAction("nao-existe", "#3366cc")).toEqual({ data: null, error: expect.stringContaining("indisponível") });
    });

    it("gera a escolha seed e valida a semente", async () => {
      const ok = await generateSeedPaletteAction("venore-slime", "#3366cc");
      expect(ok.data?.choice).toMatchObject({ mode: "seed", seed: "#3366cc" });
      expect((await generateSeedPaletteAction("venore-slime", "javascript:")).error).toBeTruthy();
    });

    it("contraste: escolha inválida pro schema é recusada", async () => {
      expect((await checkPaletteContrastAction("venore-slime", { mode: "custom", light: { primary: "red" }, dark: {} })).error).toBeTruthy();
      expect(await checkPaletteContrastAction("venore-slime", { mode: "default" })).toEqual({ data: [], error: null });
    });
  });
});
