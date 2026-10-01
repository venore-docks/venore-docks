import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import semver from "semver";
import { describe, expect, it } from "vitest";
import { SUPPORTED_THEME_CONTRACT_RANGE, V8_THEME_CONTRACT_RANGE } from "@/contexts/themes/contracts/contract-version";
import { THEME_REGISTRY } from "./registry";

// Invariantes estruturais do registro estático (docs/venore-docks.md — "Sobre temas";
// docs/themes/theme-system-v8.md). Não há scan de filesystem em runtime; a única defesa contra
// drift entre a chave do registro, a `manifest.key` e o seletor `[data-theme]` é esta suíte.
describe("THEME_REGISTRY", () => {
  const entries = Object.entries(THEME_REGISTRY);

  it("tem pelo menos o venore-slime (fallback obrigatório do sistema)", () => {
    expect(THEME_REGISTRY["venore-slime"]).toBeDefined();
  });

  it.each(entries)("%s: manifest.key bate com a chave do registro", (registryKey, entry) => {
    expect(entry.manifest.key).toBe(registryKey);
  });

  it.each(entries)("%s: 7.x expõe um Shell chamável; 8.x uma definition com o mesmo manifesto", (_registryKey, entry) => {
    if (entry.contract === 7) {
      expect(typeof entry.Shell).toBe("function");
    } else {
      expect(entry.definition.manifest).toBe(entry.manifest);
      expect(semver.satisfies(entry.manifest.themeContractVersion, V8_THEME_CONTRACT_RANGE)).toBe(true);
      expect(entry.lineage[0]).toBe(entry.manifest.key);
    }
  });

  it.each(entries)(
    "%s: themeContractVersion satisfaz o intervalo suportado pelo core (%s)",
    (_registryKey, entry) => {
      expect(semver.valid(entry.manifest.themeContractVersion)).not.toBeNull();
      expect(
        semver.satisfies(entry.manifest.themeContractVersion, SUPPORTED_THEME_CONTRACT_RANGE),
      ).toBe(true);
    },
  );

  it.each(entries)("%s: colorModes é não-vazio e só contém light/dark", (_registryKey, entry) => {
    expect(entry.manifest.colorModes.length).toBeGreaterThan(0);
    expect(entry.manifest.colorModes.every((mode) => mode === "light" || mode === "dark")).toBe(true);
    expect(new Set(entry.manifest.colorModes).size).toBe(entry.manifest.colorModes.length);
  });

  it.each(entries)("%s: packageVersion é semver", (_registryKey, entry) => {
    expect(semver.valid(entry.packageVersion)).not.toBeNull();
  });

  // Override de região/template de tema v8 precisa ser server component (invariante §0.7): o
  // módulo `<pkg>/theme` não pode começar com "use client".
  it.each(entries.filter(([, entry]) => entry.contract === 8 && entry.packageName))("%s: <pkg>/theme não é 'use client'", (key) => {
    const file = path.join(process.cwd(), "node_modules", `@venore/theme-${key}`);
    const candidates = ["theme.ts", "theme.tsx"].map((name) => path.join(file, name)).filter((candidate) => existsSync(candidate));
    for (const candidate of candidates) {
      expect(readFileSync(candidate, "utf-8").trimStart().startsWith('"use client"')).toBe(false);
    }
  });
});

// Relatório do codegen (scripts/gen-theme-registry.ts): qualquer erro (chave reservada,
// duplicada, venoreTheme inconsistente com o pacote, extends inválido) falha o CI.
describe("theme-report.generated.json", () => {
  const reportPath = path.join(process.cwd(), "src/themes/theme-report.generated.json");

  it("não tem erros", () => {
    if (!existsSync(reportPath)) return; // registro gerado por versão anterior do codegen
    const report = JSON.parse(readFileSync(reportPath, "utf-8")) as { issues: { level: string; message: string }[] };
    expect(report.issues.filter((issue) => issue.level === "error")).toEqual([]);
  });

  it("toda entrada gerada do registro está no relatório com a mesma versão de pacote", () => {
    if (!existsSync(reportPath)) return;
    const report = JSON.parse(readFileSync(reportPath, "utf-8")) as { themes: { key: string; packageVersion: string; contract: number }[] };
    for (const theme of report.themes) {
      expect(THEME_REGISTRY[theme.key]?.packageVersion).toBe(theme.packageVersion);
      expect(THEME_REGISTRY[theme.key]?.contract).toBe(theme.contract);
    }
  });
});
