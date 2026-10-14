import { describe, expect, it } from "vitest";
import { buildThemeRegistry, type ThemePackageInput } from "../../scripts/lib/theme-registry-codegen";
import {
  buildThemeTokensModule,
  buildThemeTokenValues,
  parseDeclarations,
  parseThemeTokens,
} from "../../scripts/theme-tokens";

// Parser de tokens do codegen (scripts/theme-tokens.ts, W1) → src/themes/theme-tokens.generated.ts.
const css = (key: string, base: string, dark = "") =>
  `/* cabeçalho */\n[data-theme="${key}"] {\n${base}\n}\n[data-theme="${key}"] [data-x] { --ignorado: #000; }\n` +
  (dark ? `[data-theme="${key}"].dark {\n${dark}\n}\n` : "");

describe("parseDeclarations", () => {
  it("só tokens de cor (ou var()); ignora gradiente, sombra, dimensão e comentário", () => {
    const body = `
      --background: oklch(0.98 0.01 150); /* comentário: --x: #fff; */
      --ring: var(--primary);
      --soft: color-mix(in oklch, var(--primary) 20%, transparent);
      --hex: #abc;
      --radius: 0.375rem;
      --shadow: 0 1px 2px var(--shadow-color);
      --bg: linear-gradient(180deg, var(--a) 0%, var(--b) 100%);
      --multi: radial-gradient(
        120% 80% at 15% 0%,
        color-mix(in oklch, var(--accent) 7%, transparent) 0%,
        transparent 55%
      );
      --ease: cubic-bezier(0.2, 0, 0, 1)`;
    expect(parseDeclarations(body)).toEqual({
      background: "oklch(0.98 0.01 150)",
      ring: "var(--primary)",
      soft: "color-mix(in oklch, var(--primary) 20%, transparent)",
      hex: "#abc",
    });
  });
});

describe("parseThemeTokens", () => {
  it("dark efetivo = base + .dark; regra aninhada fora do bloco não entra", () => {
    const values = parseThemeTokens(css("k", "--background: #fff; --primary: #00f;", "--background: #000;"), "k");
    expect(values).toEqual({
      light: { background: "#fff", primary: "#00f" },
      dark: { background: "#000", primary: "#00f" },
    });
  });

  it("sem o bloco base do tema = null", () => {
    expect(parseThemeTokens(css("k", "--a: #fff;"), "outro")).toBeNull();
  });
});

describe("buildThemeTokenValues (lineage)", () => {
  it("filho por cima do pai; .dark do pai vence o base do filho (cascata do :is())", () => {
    const values = buildThemeTokenValues(
      [
        { key: "pai", css: css("pai", "--primary: #111; --accent: #222;", "--primary: #333;") },
        { key: "filho", css: css("filho", "--accent: #444; --primary: #555;") },
      ],
      { filho: ["filho", "pai"], pai: ["pai"] },
    );
    expect(values.filho.light).toEqual({ primary: "#555", accent: "#444" });
    // o filho só redeclarou --primary no base: no escuro o .dark do pai ainda vence
    expect(values.filho.dark).toEqual({ primary: "#333", accent: "#444" });
    expect(values.pai.dark.primary).toBe("#333");
  });

  it("o módulo gerado é TS válido com o tipo exportado", () => {
    const source = buildThemeTokensModule([{ key: "k", css: css("k", "--background: #fff;") }]);
    expect(source).toContain("export type ThemeTokenValues");
    expect(source).toContain(`"background": "#fff"`);
  });
});

describe("hook no buildThemeRegistry", () => {
  const input = (key: string, themeCss?: string): ThemePackageInput => ({
    dep: `@venore/theme-${key}`,
    packageJson: { version: "1.0.0" },
    resolvable: { manifest: true, theme: false, colorPalettes: true, themeClient: false },
    sourceDir: `../../node_modules/@venore/theme-${key}`,
    themeCss,
  });

  it("emite os tokens do slime e de cada pacote com theme.css", () => {
    const out = buildThemeRegistry([input("aurora", css("aurora", "--primary: #f00;")), input("nite")], {
      strict: false,
      slimeCss: css("venore-slime", "--primary: #0f0;"),
    });
    expect(out.tokensModule).toContain(`"venore-slime"`);
    expect(out.tokensModule).toContain(`"aurora"`);
    expect(out.tokensModule).not.toContain(`"nite"`);
  });

  it("sem CSS nenhum, o módulo continua válido (mapa vazio)", () => {
    expect(buildThemeRegistry([], { strict: false }).tokensModule).toContain("THEME_TOKEN_VALUES: Record<string, ThemeTokenValues> = {}");
  });
});
