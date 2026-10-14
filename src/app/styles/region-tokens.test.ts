import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CANONICAL_SECTION_STYLES, REGION_TOKEN_ROLES, THEME_TOKEN_REGIONS } from "@/contexts/themes/contracts/v8";
import { createTokenResolver } from "@/platform/theme-engine/token-values";
import { THEME_TOKEN_VALUES } from "@/themes/theme-tokens.generated";
import { extractRuleBody } from "@/themes/theme-token-contract";
import { parseDeclarations } from "../../../scripts/theme-tokens";

// region-tokens.css (spec v8 §3, W1): defaults identidade, remapeamento completo, só var().
const css = readFileSync(fileURLToPath(new URL("./region-tokens.css", import.meta.url)), "utf8");
const defaults = parseDeclarations(extractRuleBody(css, ":where([data-theme])") ?? "");
const SECTION_STYLES = CANONICAL_SECTION_STYLES.filter((style) => style !== "default");

describe("region-tokens.css", () => {
  it("declara o default de todo papel de toda região — identidade (o próprio tier-2)", () => {
    for (const region of THEME_TOKEN_REGIONS) {
      for (const role of REGION_TOKEN_ROLES) {
        expect(defaults[`region-${region}-${role}`], `--region-${region}-${role}`).toBe(`var(--${role})`);
      }
    }
  });

  it("declara o default de todo papel de todo estilo de seção, sempre por var()", () => {
    for (const style of SECTION_STYLES) {
      for (const role of REGION_TOKEN_ROLES) {
        expect(defaults[`section-${style}-${role}`], `--section-${style}-${role}`).toMatch(/^var\(--[a-z-]+\)$/);
      }
    }
  });

  it("remapeia todo papel shadcn dentro de [data-region] e [data-section-style]", () => {
    for (const region of THEME_TOKEN_REGIONS) {
      const body = parseDeclarations(extractRuleBody(css, `[data-region="${region}"]`) ?? "");
      for (const role of REGION_TOKEN_ROLES) expect(body[role]).toBe(`var(--region-${region}-${role})`);
    }
    for (const style of SECTION_STYLES) {
      const body = parseDeclarations(extractRuleBody(css, `[data-section-style="${style}"]`) ?? "");
      for (const role of REGION_TOKEN_ROLES) expect(body[role]).toBe(`var(--section-${style}-${role})`);
    }
    // "default" é o próprio tier-2: sem bloco
    expect(css).not.toContain(`[data-section-style="default"]`);
  });

  it("defaults com especificidade 0 (:where) — o theme.css e a paleta vencem sem depender de ordem", () => {
    expect(css).toMatch(/^:where\(\[data-theme\]\) \{/m);
    expect(css).not.toMatch(/^\[data-theme/m);
  });

  // "Estilo computado" simulado: o tier-3 é computado no <html> (onde mora data-theme) e herdado;
  // dentro de [data-region] o papel lê o tier-3. Com só os defaults, todo papel resolve pra MESMA
  // cor de fora da região — em todo tema do registro, nos dois modos (paridade do slime incluída).
  it("com só os defaults, o valor computado de cada papel dentro de cada região é o de fora", () => {
    for (const [key, values] of Object.entries(THEME_TOKEN_VALUES)) {
      for (const mode of ["light", "dark"] as const) {
        const html = createTokenResolver({ ...values[mode], ...defaults });
        for (const region of THEME_TOKEN_REGIONS) {
          for (const role of REGION_TOKEN_ROLES) {
            const outside = html.color(role);
            const inside = html.color(`region-${region}-${role}`);
            expect(inside, `${key} ${mode} ${region} ${role}`).toEqual(outside);
          }
        }
      }
    }
  });

  it("um tier-3 declarado pelo tema muda o papel só dentro da região", () => {
    const html = createTokenResolver({
      ...THEME_TOKEN_VALUES["venore-slime"].light,
      ...defaults,
      "region-rail-background": "oklch(0.2 0.02 160)",
    });
    expect(html.color("region-rail-background")).toMatchObject({ l: 0.2 });
    expect(html.color("background")).toMatchObject({ l: 0.986 });
    expect(html.color("region-header-background")).toMatchObject({ l: 0.986 });
  });
});
