import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { chainDeclaredTokens } from "../../scripts/theme-lineage";
import { THEME_REGISTRY } from "./registry";
import {
  declaredTokenNames,
  extractRuleBody,
  isColorValue,
  isOptionalV8Token,
  SLIME_IDENTITY_TOKENS,
  tokenValue,
} from "./theme-token-contract";

const THEMES_DIR = join(process.cwd(), "src", "themes");
const require = createRequire(import.meta.url);
// Tema em src/themes/<key>/ ou pacote @venore/theme-<key> instalado (theme.css em node_modules).
const themeCssPath = (key: string): string | null => {
  const local = join(THEMES_DIR, key, "theme.css");
  if (existsSync(local)) return local;
  try {
    return require.resolve(`@venore/theme-${key}/theme.css`);
  } catch {
    return null;
  }
};
const readThemeCss = (key: string) => readFileSync(themeCssPath(key)!, "utf8");

// O contrato É o que o venore-slime declara (menos a identidade exclusiva dele).
const slimeCss = readThemeCss("venore-slime");
const slimeBase = extractRuleBody(slimeCss, `[data-theme="venore-slime"]`);
const slimeDark = extractRuleBody(slimeCss, `[data-theme="venore-slime"].dark`);
if (!slimeBase || !slimeDark) {
  throw new Error("venore-slime/theme.css não tem os blocos [data-theme] / [data-theme].dark esperados.");
}

const identity = new Set(SLIME_IDENTITY_TOKENS);
// Tier 3 da v8 (OPTIONAL_V8_TOKENS) nunca vira obrigatório, mesmo que o slime passe a declarar.
const baseContract = declaredTokenNames(slimeBase).filter((name) => !identity.has(name) && !isOptionalV8Token(name));
const slimeDarkNames = new Set(declaredTokenNames(slimeDark));
// Tokens de cor que o slime REDECLARA no bloco .dark = os que flipam entre light/dark. Todo tema
// precisa flipar os mesmos. Tokens de cor que o slime deixa só no base (--overlay-foreground,
// --presentation-*) são "congelados" de propósito e ficam fora da exigência de dark.
const darkContract = baseContract.filter(
  (name) => slimeDarkNames.has(name) && isColorValue(tokenValue(slimeBase, name) ?? ""),
);

describe("contrato de tokens de tema", () => {
  it("o contrato derivado do venore-slime não está vazio (sanidade do parser)", () => {
    expect(baseContract.length).toBeGreaterThan(50);
    expect(darkContract.length).toBeGreaterThan(20);
  });

  // Todo tema do registro: os de src/themes/ e os pacotes @venore/theme-* instalados (os repos de
  // tema não têm CI próprio que rode este contrato).
  const themeKeys = Object.keys(THEME_REGISTRY).filter((key) => themeCssPath(key) !== null);

  for (const key of themeKeys) {
    const entry = THEME_REGISTRY[key];
    const lineage = entry.contract === 8 ? entry.lineage : [key];
    // Tema que estende outro (spec §3.1): o contrato vale pro tema EFETIVO — o theme.css dele só
    // tem diffs; o resto vem dos ancestrais pela lineage gerada (scripts/theme-lineage.ts).
    if (lineage.length > 1) {
      describe(`${key} (cadeia ${lineage.join(" → ")})`, () => {
        const cssOf = (member: string) => (themeCssPath(member) ? readThemeCss(member) : undefined);
        const tokens = chainDeclaredTokens(lineage, cssOf);

        it("a cadeia declara todo token do contrato no base", () => {
          const present = new Set(tokens.base);
          expect(baseContract.filter((name) => !present.has(name)), `faltando na cadeia de ${key}`).toEqual([]);
        });

        it("a cadeia redeclara no .dark todo token de cor que o slime flipa", () => {
          const present = new Set(tokens.dark);
          expect(darkContract.filter((name) => !present.has(name)), `faltando no .dark da cadeia de ${key}`).toEqual([]);
        });
      });
      continue;
    }
    describe(key, () => {
      const css = readThemeCss(key);
      const base = extractRuleBody(css, `[data-theme="${key}"]`);
      const dark = extractRuleBody(css, `[data-theme="${key}"].dark`);

      it("tem o bloco base [data-theme] e o bloco .dark", () => {
        expect(base, `[data-theme="${key}"] {`).toBeTruthy();
        expect(dark, `[data-theme="${key}"].dark {`).toBeTruthy();
      });

      it("o bloco base declara todo token do contrato", () => {
        const present = new Set(declaredTokenNames(base ?? ""));
        const missing = baseContract.filter((name) => !present.has(name));
        expect(missing, `faltando no bloco base de ${key}`).toEqual([]);
      });

      it("o bloco .dark redeclara todo token de cor que o slime flipa", () => {
        const present = new Set(declaredTokenNames(dark ?? ""));
        const missing = darkContract.filter((name) => !present.has(name));
        expect(missing, `faltando no bloco .dark de ${key}`).toEqual([]);
      });
    });
  }
});
