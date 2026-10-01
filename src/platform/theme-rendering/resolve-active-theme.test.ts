import { beforeEach, describe, expect, it, vi } from "vitest";

const getActiveTheme = vi.fn();

vi.mock("@/contexts/themes", () => ({
  getActiveTheme: (...args: unknown[]) => getActiveTheme(...args),
}));

// Tema sem `Shell` válido é erro explícito na carga (docs/themes/shell-contract.md — Fase 2),
// nunca uma degradação silenciosa pra alguma shell própria da aplicação. Mocka THEME_REGISTRY pra
// simular um tema mal registrado sem precisar de um tema quebrado de verdade em src/themes/.
vi.mock("@/themes/registry", () => ({
  THEME_REGISTRY: {
    "venore-slime": { manifest: { key: "venore-slime", name: "Venore Slime", version: "0.1.0", themeContractVersion: "6.0.0" }, contract: 7, Shell: () => null },
    "broken-theme": { manifest: { key: "broken-theme", name: "Broken", version: "0.1.0", themeContractVersion: "6.0.0" }, contract: 7 },
  },
}));

describe("resolveActiveTheme", () => {
  beforeEach(() => {
    getActiveTheme.mockReset();
    // resolveActiveTheme é memoizado por React cache() — sem resetModules(), o valor resolvido
    // no primeiro teste vazaria pros seguintes (cache() não sabe que é um novo "request" de
    // teste).
    vi.resetModules();
  });

  it("resolves the entry for a theme that has a valid Shell", async () => {
    getActiveTheme.mockResolvedValue({ success: true, data: { themeKey: "venore-slime", activatedAt: new Date() } });

    const { resolveActiveTheme } = await import("./resolve-active-theme");
    const entry = await resolveActiveTheme();

    expect(entry.manifest.key).toBe("venore-slime");
    expect(entry.contract === 7 && typeof entry.Shell).toBe("function");
  });

  it("throws explicitly instead of falling back silently when the resolved theme has no Shell", async () => {
    getActiveTheme.mockResolvedValue({ success: true, data: { themeKey: "broken-theme", activatedAt: new Date() } });

    const { resolveActiveTheme } = await import("./resolve-active-theme");

    await expect(resolveActiveTheme()).rejects.toThrow(/sem um Shell válido/);
  });

  it("falls back to venore-slime (not an error) when active theme configuration fails to resolve", async () => {
    getActiveTheme.mockResolvedValue({ success: false, error: { code: "settings.read.failed", message: "boom" } });

    const { resolveActiveTheme } = await import("./resolve-active-theme");
    const entry = await resolveActiveTheme();

    expect(entry.manifest.key).toBe("venore-slime");
  });
});
