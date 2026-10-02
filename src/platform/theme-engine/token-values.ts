import type { PaletteColorTokens } from "@/contexts/themes";
import type { RegionTokenRole, ThemeTokenRegion } from "@/contexts/themes/contracts/v8";
import { THEME_TOKEN_REGIONS } from "@/contexts/themes/contracts/v8";
import { THEME_TOKEN_VALUES, type ThemeTokenValues } from "@/themes/theme-tokens.generated";
import { mixOklch, parseCssColor, type CssColor } from "./oklch-color";

export { THEME_TOKEN_REGIONS };

// Valores de token por tema (spec v8 §3/§7.14). A fonte é `theme-tokens.generated.ts` — o codegen
// parseia o theme.css de cada tema (scripts/theme-tokens.ts), então gerador de paleta, checagem de
// contraste e SEO leem os MESMOS valores que o navegador aplica, sem literal duplicado aqui.
// Mapas são `nome-do-token (sem "--") → valor CSS cru` (pode ser var(), color-mix(), oklch()).

export type TokenMap = Readonly<Record<string, string>>;

export function getThemeTokenValues(themeKey: string): ThemeTokenValues | null {
  return THEME_TOKEN_VALUES[themeKey] ?? null;
}

// Tokens efetivos de um modo: os do tema com a paleta (override runtime) por cima — mesma cascata
// do <style id="theme-runtime">, que vence o theme.css.
export function effectiveTokens(
  base: ThemeTokenValues | null,
  palette?: { light?: PaletteColorTokens | TokenMap; dark?: PaletteColorTokens | TokenMap } | null,
): { light: Record<string, string>; dark: Record<string, string> } {
  return {
    light: { ...(base?.light ?? {}), ...stripUndefined(palette?.light) },
    dark: { ...(base?.dark ?? {}), ...stripUndefined(palette?.dark) },
  };
}

function stripUndefined(tokens: Readonly<Record<string, string | undefined>> | undefined): Record<string, string> {
  return Object.fromEntries(Object.entries(tokens ?? {}).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
}

// Divide argumentos de função CSS por vírgula de nível 0 (aguenta var()/oklch() aninhados).
function splitTopLevel(input: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const char of input) {
    if (char === "(") depth++;
    else if (char === ")") depth--;
    if (char === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  parts.push(current.trim());
  return parts;
}

// Corpo de `name(...)` quando a expressão inteira é essa função; null caso contrário.
function functionBody(expression: string, name: string): string | null {
  const trimmed = expression.trim();
  if (!trimmed.toLowerCase().startsWith(`${name}(`) || !trimmed.endsWith(")")) return null;
  const body = trimmed.slice(name.length + 1, -1);
  let depth = 0;
  for (const char of body) {
    if (char === "(") depth++;
    else if (char === ")") depth--;
    if (depth < 0) return null; // o ")" final não fecha a função do começo
  }
  return depth === 0 ? body : null;
}

const MAX_DEPTH = 24;

export type TokenResolver = {
  // Cor resolvida do token (var() e color-mix() seguidos), ou null (não é cor / não existe / ciclo).
  color(name: string): CssColor | null;
  // Cor de uma expressão CSS arbitrária no contexto deste mapa.
  expression(value: string): CssColor | null;
};

export function createTokenResolver(tokens: TokenMap): TokenResolver {
  const memo = new Map<string, CssColor | null>();

  const resolveToken = (name: string, stack: readonly string[]): CssColor | null => {
    if (memo.has(name)) return memo.get(name)!;
    if (stack.includes(name) || stack.length > MAX_DEPTH) return null; // ciclo = valor inválido (como no CSS)
    const raw = tokens[name];
    const resolved = raw === undefined ? null : resolveExpression(raw, [...stack, name]);
    memo.set(name, resolved);
    return resolved;
  };

  const resolveExpression = (value: string, stack: readonly string[]): CssColor | null => {
    const varBody = functionBody(value, "var");
    if (varBody !== null) {
      const [reference, ...fallback] = splitTopLevel(varBody);
      const name = reference.replace(/^--/, "");
      if (tokens[name] !== undefined) return resolveToken(name, stack);
      return fallback.length > 0 ? resolveExpression(fallback.join(", "), stack) : null;
    }

    const mixBody = functionBody(value, "color-mix");
    if (mixBody !== null) return resolveColorMix(mixBody, stack);

    return parseCssColor(value);
  };

  // color-mix(in oklch, A [p%], B [q%]) — só o espaço oklch (o único usado nos temas instalados).
  const resolveColorMix = (body: string, stack: readonly string[]): CssColor | null => {
    const [space, first, second] = splitTopLevel(body);
    if (!/^in\s+oklch$/i.test(space ?? "") || !first || !second) return null;
    const parseStop = (stop: string) => {
      const match = /^(.*?)(?:\s+([\d.]+)%)?$/.exec(stop.trim());
      const percentage = match?.[2] !== undefined ? Number(match[2]) : null;
      return { color: resolveExpression(match?.[1] ?? stop, stack), percentage };
    };
    const a = parseStop(first);
    const b = parseStop(second);
    if (!a.color || !b.color) return null;

    let pa = a.percentage;
    let pb = b.percentage;
    if (pa === null && pb === null) pa = pb = 50;
    else if (pa === null) pa = 100 - pb!;
    else if (pb === null) pb = 100 - pa;
    const sum = pa + pb!;
    if (sum <= 0) return null;
    return mixOklch(a.color, b.color, pa / sum, sum < 100 ? sum / 100 : 1);
  };

  return {
    color: (name) => resolveToken(name.replace(/^--/, ""), []),
    expression: (value) => resolveExpression(value, []),
  };
}

export function regionTokenName(region: ThemeTokenRegion, role: RegionTokenRole): string {
  return `region-${region}-${role}`;
}

// Superfície que o kit REALMENTE pinta em cada região quando o tema não declara o token tier-3:
// o header pinta --header-bg e o rail o gradiente --sidebar-bg (cor de partida --sidebar-bg-start).
// O remapeamento de region-tokens.css continua identidade (paridade do slime); isto é só o que a
// checagem de contraste usa como fundo, pra medir o que o usuário vê.
const SURFACE_FALLBACKS: Partial<Record<ThemeTokenRegion, Partial<Record<RegionTokenRole, readonly string[]>>>> = {
  header: { background: ["header-bg"], foreground: ["header-fg"] },
  rail: { background: ["sidebar-bg-start"] },
};

// Nome do token a ler pra `role` dentro de `region`: o tier-3 declarado, senão a superfície do kit,
// senão o tier-2 (o default de region-tokens.css).
export function regionSurfaceToken(region: ThemeTokenRegion, role: RegionTokenRole, tokens: TokenMap): string {
  const tier3 = regionTokenName(region, role);
  if (tokens[tier3] !== undefined) return tier3;
  for (const candidate of SURFACE_FALLBACKS[region]?.[role] ?? []) {
    if (tokens[candidate] !== undefined) return candidate;
  }
  return role;
}
