import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CANONICAL_SECTION_STYLES, REGION_TOKEN_ROLES, THEME_TOKEN_REGIONS } from "@/contexts/themes/contracts/v8";
import { THEME_REGISTRY } from "./registry";
import {
  declaredTokenNames,
  extractRuleBody,
  isOptionalV8Token,
  isUnknownTier3Token,
  OPTIONAL_V8_TOKENS,
} from "./theme-token-contract";

// Tier 3 da v8 no contrato de tokens (spec §3): lista espelha os enums do contrato, e nenhum tema
// declara um nome de tier-3 que não existe.
const require = createRequire(import.meta.url);
const themeCss = (key: string): string | null => {
  const local = join(process.cwd(), "src", "themes", key, "theme.css");
  if (existsSync(local)) return readFileSync(local, "utf8");
  try {
    return readFileSync(require.resolve(`@venore/theme-${key}/theme.css`), "utf8");
  } catch {
    return null;
  }
};

describe("OPTIONAL_V8_TOKENS", () => {
  it("é exatamente região × papel + estilo de seção (sem default) × papel, dos enums do contrato", () => {
    const expected = [
      ...THEME_TOKEN_REGIONS.flatMap((region) => REGION_TOKEN_ROLES.map((role) => `--region-${region}-${role}`)),
      ...CANONICAL_SECTION_STYLES.filter((style) => style !== "default").flatMap((style) =>
        REGION_TOKEN_ROLES.map((role) => `--section-${style}-${role}`),
      ),
    ];
    expect([...OPTIONAL_V8_TOKENS].sort()).toEqual(expected.sort());
  });

  it("classifica tier-3 válido, inválido e tier-2", () => {
    expect(isOptionalV8Token("--region-rail-background")).toBe(true);
    expect(isUnknownTier3Token("--region-sidebar-background")).toBe(true);
    expect(isUnknownTier3Token("--section-brand-glow")).toBe(true);
    expect(isUnknownTier3Token("--background")).toBe(false);
  });

  for (const key of Object.keys(THEME_REGISTRY)) {
    it(`${key}: só declara tier-3 conhecido`, () => {
      const css = themeCss(key);
      if (!css) return;
      const names = [`[data-theme="${key}"]`, `[data-theme="${key}"].dark`].flatMap((selector) =>
        declaredTokenNames(extractRuleBody(css, selector) ?? ""),
      );
      expect(names.filter(isUnknownTier3Token)).toEqual([]);
    });
  }
});
