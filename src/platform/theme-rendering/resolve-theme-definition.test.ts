import { describe, expect, it, vi } from "vitest";
import { Shell } from "@/themes/venore-slime/components/Shell";
import { venoreSlimeManifest } from "@/themes/venore-slime/manifest";
import { venoreSlimeTheme } from "@/themes/venore-slime/theme";
import type { ThemeRegistryEntry } from "@/themes/registry";

vi.mock("next/navigation", () => ({ usePathname: () => null }));

const slime: ThemeRegistryEntry = {
  contract: 8,
  manifest: venoreSlimeManifest,
  definition: venoreSlimeTheme,
  colorPalettes: [],
  packageVersion: "0.1.0",
  packageName: null,
  lineage: ["venore-slime"],
};
const legacy = (key: string, themeContractVersion: string): ThemeRegistryEntry => ({
  contract: 7,
  manifest: { ...venoreSlimeManifest, key, themeContractVersion },
  Shell,
  colorPalettes: [{ id: "p", name: "P", light: {}, dark: {} }],
  packageVersion: "1.0.0",
  packageName: `@venore/theme-${key}`,
});
const registry: Record<string, ThemeRegistryEntry> = {
  "venore-slime": slime,
  nite: legacy("nite", "7.0.0"),
  ancient: legacy("ancient", "6.0.0"),
  future: legacy("future", "9.0.0"),
};

describe("resolveThemeDefinition — recheck no render (spec §6 passo 7)", () => {
  it("7.x válido vira adapter (legacyShell) com kit no resto e só content.before/after", async () => {
    const { resolveThemeDefinition } = await import("./resolve-theme-definition");
    const { theme, fallback } = resolveThemeDefinition("nite", { registry });
    expect(fallback).toBeNull();
    expect(theme.contract).toBe(7);
    expect(theme.legacyShell).toBe(Shell);
    expect(theme.options).toEqual([]);
    expect(theme.outletsRendered).toEqual(["content.before", "content.after"]);
    expect(theme.colorPalettes).toHaveLength(1);
  });

  it("slime v8: layout topbar, nenhuma região substituída, todos os outlets", async () => {
    const { resolveThemeDefinition } = await import("./resolve-theme-definition");
    const { theme } = resolveThemeDefinition("venore-slime", { registry });
    expect(theme.contract).toBe(8);
    expect(theme.layout).toBe("topbar");
    expect(theme.replacedRegions).toEqual([]);
    expect(theme.outletsRendered.length).toBe(13);
    expect(Object.keys(theme.templates.entry)).toEqual(["default"]);
  });

  it.each([
    ["ghost", "missing-theme"],
    ["ancient", "out-of-range"],
    ["future", "out-of-range"],
  ])("%s cai no slime com diagnóstico %s", async (key, reason) => {
    const { resolveThemeDefinition } = await import("./resolve-theme-definition");
    const { theme, fallback } = resolveThemeDefinition(key, { registry });
    expect(theme.key).toBe("venore-slime");
    expect(fallback).toEqual({ reason, requestedKey: key });
  });

  it("tema desabilitado cai no slime (quando o chamador informa o estado)", async () => {
    const { resolveThemeDefinition } = await import("./resolve-theme-definition");
    const { theme, fallback } = resolveThemeDefinition("nite", { registry, isEnabled: (key) => key !== "nite" });
    expect(theme.key).toBe("venore-slime");
    expect(fallback).toEqual({ reason: "disabled", requestedKey: "nite" });
  });

  it("admin sob v8: kit topbar mantendo chave, manifesto e paletas do tema", async () => {
    const { resolveThemeDefinition, toKitAdminDefinition } = await import("./resolve-theme-definition");
    const { theme } = resolveThemeDefinition("venore-slime", { registry });
    const admin = toKitAdminDefinition({ ...theme, key: "x", layout: () => null, replacedRegions: ["header"] });
    expect(admin.key).toBe("x");
    expect(admin.layout).toBe("topbar");
    expect(admin.replacedRegions).toEqual([]);
  });
});

describe("areaForPathname — área só pelo caminho (invariante §0.5)", () => {
  it.each([
    ["/admin", "admin"],
    ["/admin/themes", "admin"],
    ["/administrador", "public"],
    ["/", "public"],
    [null, "public"],
  ])("%s → %s", async (pathname, area) => {
    const { areaForPathname } = await import("./area");
    expect(areaForPathname(pathname)).toBe(area);
  });
});
