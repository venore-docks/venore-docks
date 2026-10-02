import { describe, expect, it } from "vitest";
import { ThemeCodegenError, buildThemeRegistry, type ThemePackageInput } from "../../scripts/lib/theme-registry-codegen";

const v7 = (key: string, version = "1.0.0"): ThemePackageInput => ({
  dep: `@venore/theme-${key}`,
  packageJson: { version },
  resolvable: { manifest: true, theme: false, colorPalettes: true, themeClient: false },
  sourceDir: `../../node_modules/@venore/theme-${key}`,
});
const v8 = (key: string, extra: { extends?: string; themeClient?: boolean; venoreKey?: string } = {}): ThemePackageInput => ({
  dep: `@venore/theme-${key}`,
  packageJson: { version: "2.0.0", venoreTheme: { contract: "8.0.0", key: extra.venoreKey ?? key, extends: extra.extends } },
  resolvable: { manifest: true, theme: true, colorPalettes: false, themeClient: Boolean(extra.themeClient) },
  sourceDir: `../../node_modules/@venore/theme-${key}`,
});

describe("buildThemeRegistry (codegen de temas, spec §5)", () => {
  it("7.x: mesma forma de antes + contract/packageVersion/packageName", () => {
    const out = buildThemeRegistry([v7("aurora", "0.1.13")], { strict: true });
    expect(out.registry).toContain(`import { Shell as auroraShell } from "@venore/theme-aurora";`);
    expect(out.registry).toContain(`contract: 7,`);
    expect(out.registry).toContain(`packageVersion: "0.1.13",`);
    expect(out.cssImports).toContain(`@import "@venore/theme-aurora/theme.css";`);
    expect(out.report.issues).toEqual([]);
  });

  it("8.x: importa <pkg>/theme e emite lineage; theme-client vira entrada lazy no registro client", () => {
    const out = buildThemeRegistry([v8("halo", { themeClient: true }), v8("halo-noir", { extends: "halo" })], { strict: true });
    expect(out.registry).toContain(`import haloTheme from "@venore/theme-halo/theme";`);
    expect(out.registry).toContain(`lineage: ["halo-noir","halo"]`);
    expect(out.clientRegistry.startsWith(`"use client";`)).toBe(true);
    expect(out.clientRegistry).toContain(`"halo": () => import("@venore/theme-halo/theme-client")`);
    expect(out.clientRegistry).not.toContain("halo-noir");
  });

  it("pacote @venore/theme-venore-slime faz o modo estrito lançar", () => {
    expect(() => buildThemeRegistry([v7("venore-slime")], { strict: true })).toThrow(ThemeCodegenError);
  });

  it("modo leniente: avisa, exclui o tema e registra o erro no relatório", () => {
    const out = buildThemeRegistry([v7("venore-slime"), v7("nite")], { strict: false });
    expect(out.registry).not.toContain("venore-slime");
    expect(out.registry).toContain(`"nite"`);
    expect(out.report.issues).toEqual([expect.objectContaining({ level: "error", code: "reserved-key", themeKey: "venore-slime" })]);
  });

  it("venoreTheme.key diferente da chave do pacote, extends desconhecido e ciclo são erros", () => {
    const out = buildThemeRegistry(
      [v8("a", { venoreKey: "b" }), v8("c", { extends: "ghost" }), v8("d", { extends: "e" }), v8("e", { extends: "d" })],
      { strict: false },
    );
    expect(out.report.issues.map((issue) => issue.code).sort()).toEqual(["extends-cycle", "extends-cycle", "extends-unknown", "key-mismatch"]);
    expect(out.report.themes).toEqual([]);
  });

  it("chave duplicada é erro", () => {
    expect(() => buildThemeRegistry([v7("nite"), v7("nite")], { strict: true })).toThrow(/duplicada/);
  });
});
