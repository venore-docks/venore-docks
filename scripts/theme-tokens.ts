// Parser de tokens de tema pro codegen (spec v8 §5): lê o theme.css de cada tema e emite
// `src/themes/theme-tokens.generated.ts` — os valores light/dark de cada tema EFETIVO (com os
// ancestrais da lineage por baixo). Entrada do gerador de paleta, da checagem de contraste e do
// themeColor derivado (SEO). Dono: W1. Puro (sem disco): scripts/lib/theme-registry-codegen.ts
// chama buildThemeTokensModule com o CSS que scripts/gen-theme-registry.ts leu.
import { extractRuleBody } from "../src/themes/theme-token-contract";

export type ThemeTokenValues = { light: Record<string, string>; dark: Record<string, string> };
export type ThemeTokenSource = { key: string; css: string };

const HEADER = "// GERADO por scripts/gen-theme-registry.ts — NÃO editar à mão (gitignored).\n";

// Só tokens de cor (ou referência a outro token): é o que gerador/contraste/SEO consomem. Fora:
// gradientes, sombras, dimensões, durações, curvas.
const COLOR_LIKE = /^(?:var\(|color-mix\(|oklch\(|oklab\(|rgba?\(|hsla?\(|#[0-9a-f]{3,8}$|transparent$|white$|black$|currentcolor$)/i;

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

// Declarações `--nome: valor;` do NÍVEL do bloco (o corpo de extractRuleBody não tem regra aninhada
// nos temas instalados; se tiver, o conteúdo de `{...}` aninhado é ignorado).
export function parseDeclarations(ruleBody: string): Record<string, string> {
  const declarations: Record<string, string> = {};
  let depth = 0;
  let statement = "";
  for (const char of stripComments(ruleBody)) {
    if (char === "{") {
      depth++;
      statement = "";
      continue;
    }
    if (char === "}") {
      depth--;
      statement = "";
      continue;
    }
    if (depth > 0) continue;
    if (char === ";" && !hasOpenParen(statement)) {
      addDeclaration(declarations, statement);
      statement = "";
      continue;
    }
    statement += char;
  }
  addDeclaration(declarations, statement);
  return declarations;
}

function hasOpenParen(text: string): boolean {
  let depth = 0;
  for (const char of text) {
    if (char === "(") depth++;
    else if (char === ")") depth--;
  }
  return depth > 0;
}

function addDeclaration(target: Record<string, string>, statement: string): void {
  const match = /^\s*--([a-z0-9-]+)\s*:\s*([\s\S]+?)\s*$/i.exec(statement);
  if (!match) return;
  const value = match[2].replace(/\s+/g, " ");
  if (!COLOR_LIKE.test(value) || /gradient\(/i.test(value)) return;
  target[match[1]] = value;
}

type ThemeTokenBlocks = { base: Record<string, string>; dark: Record<string, string> };

function parseThemeBlocks(css: string, key: string): ThemeTokenBlocks | null {
  const base = extractRuleBody(css, `[data-theme="${key}"]`);
  if (base === null) return null;
  const dark = extractRuleBody(css, `[data-theme="${key}"].dark`);
  return { base: parseDeclarations(base), dark: dark === null ? {} : parseDeclarations(dark) };
}

// Tema efetivo de uma lineage [self, pai, avô], com a cascata do theme-lineage.generated.css (spec
// §3.1): blocos base têm especificidade (0,1,0) e os .dark (0,2,0), ancestral antes do filho. Então
// light = base do avô < pai < self; dark = light < .dark do avô < pai < self — um token que o filho
// só redeclara no base PERDE pro .dark do pai (o caso que o lint de "dark incompleto" do W9 aponta).
export function mergeLineageTokens(chain: readonly (ThemeTokenBlocks | null)[]): ThemeTokenValues {
  const ordered = [...chain].reverse().filter((blocks): blocks is ThemeTokenBlocks => blocks !== null);
  const light = Object.assign({}, ...ordered.map((blocks) => blocks.base)) as Record<string, string>;
  const dark = Object.assign({ ...light }, ...ordered.map((blocks) => blocks.dark)) as Record<string, string>;
  return { light, dark };
}

// Valores light/dark de UM theme.css (sem herança). `dark` já é o efetivo: base + bloco .dark.
export function parseThemeTokens(css: string, key: string): ThemeTokenValues | null {
  const blocks = parseThemeBlocks(css, key);
  return blocks ? mergeLineageTokens([blocks]) : null;
}

export function buildThemeTokenValues(
  sources: readonly ThemeTokenSource[],
  lineages: Readonly<Record<string, readonly string[]>> = {},
): Record<string, ThemeTokenValues> {
  const own = new Map(sources.map((source) => [source.key, parseThemeBlocks(source.css, source.key)]));
  const result: Record<string, ThemeTokenValues> = {};
  for (const { key } of [...sources].sort((a, b) => a.key.localeCompare(b.key))) {
    const chain = lineages[key] ?? [key];
    if (!own.get(key)) continue;
    result[key] = mergeLineageTokens(chain.map((member) => own.get(member) ?? null));
  }
  return result;
}

export function buildThemeTokensModule(
  sources: readonly ThemeTokenSource[],
  lineages: Readonly<Record<string, readonly string[]>> = {},
): string {
  const values = buildThemeTokenValues(sources, lineages);
  return (
    HEADER +
    `export type ThemeTokenValues = { light: Record<string, string>; dark: Record<string, string> };\n` +
    `export const THEME_TOKEN_VALUES: Record<string, ThemeTokenValues> = ${JSON.stringify(values, null, 2)};\n`
  );
}
