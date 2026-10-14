import type { RegionTokenRole, ThemePaletteRules, ThemeTokenRegion } from "@/contexts/themes/contracts/v8";
import { oklchToSrgb, type CssColor } from "./oklch-color";
import { createTokenResolver, regionSurfaceToken, regionTokenName, THEME_TOKEN_REGIONS } from "./token-values";

// Razão de contraste WCAG 2.x (luminância relativa) entre dois hex #rrggbb. Usada pra barrar
// uma paleta personalizada que zere a legibilidade (ex: texto quase da cor do fundo) antes de
// virar CSS de override — o admin escolhe cor livre no picker, sem noção de contraste.

function toLinear(channel8bit: number): number {
  const c = channel8bit / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(hex: string): number {
  const value = Number.parseInt(hex.slice(1), 16);
  const r = toLinear((value >> 16) & 0xff);
  const g = toLinear((value >> 8) & 0xff);
  const b = toLinear(value & 0xff);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Sempre >= 1. 21 = preto vs. branco. WCAG AA pra texto normal = 4.5.
export function contrastRatio(hexA: string, hexB: string): number {
  const a = relativeLuminance(hexA);
  const b = relativeLuminance(hexB);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

// Mínimo exigido entre `foreground` e `background` de uma paleta personalizada — WCAG AA texto
// normal. Presets de catálogo não passam por aqui (partem de valores já testados no theme.css).
export const MIN_CUSTOM_PALETTE_CONTRAST = 4.5;

// ── v8 (W1, spec §7.14): contraste por região ──────────────────────────────────────────────────
// Cores resolvidas (OKLCH + alpha, ver token-values.ts) em vez de hex: o token de tema é oklch(),
// às vezes com alpha ou color-mix(). Alpha é composto em sRGB não-linear (como o navegador pinta):
// o fundo sobre o `backdrop` opaco (o --background da página) e o texto sobre o fundo resultante.

type Srgb = { r: number; g: number; b: number };

function composite(top: CssColor, bottom: Srgb): Srgb {
  const rgb = oklchToSrgb(top.l, top.c, top.h);
  const alpha = top.alpha;
  return {
    r: rgb.r * alpha + bottom.r * (1 - alpha),
    g: rgb.g * alpha + bottom.g * (1 - alpha),
    b: rgb.b * alpha + bottom.b * (1 - alpha),
  };
}

function srgbLuminance({ r, g, b }: Srgb): number {
  return 0.2126 * toLinear(r * 255) + 0.7152 * toLinear(g * 255) + 0.0722 * toLinear(b * 255);
}

const WHITE: Srgb = { r: 1, g: 1, b: 1 };

// Razão WCAG entre duas cores resolvidas. `backdrop` (opaco) fica atrás de um fundo translúcido;
// sem ele, branco.
export function contrastRatioColors(foreground: CssColor, background: CssColor, backdrop?: CssColor): number {
  const base = backdrop ? composite({ ...backdrop, alpha: 1 }, WHITE) : WHITE;
  const bg = composite(background, base);
  const fg = composite(foreground, bg);
  const a = srgbLuminance(fg);
  const b = srgbLuminance(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

// Mínimos do spec §7.14: texto (fg/bg, muted-fg/bg) 4.5 — ou o `minContrast` da regra da região —
// e elementos não-textuais (ring/bg, accent/bg) 3 (WCAG 1.4.11).
export const MIN_TEXT_CONTRAST = 4.5;
export const MIN_NON_TEXT_CONTRAST = 3;

export type RegionContrastPair = "foreground/background" | "muted-foreground/background" | "ring/background" | "accent/background";
export const REGION_CONTRAST_PAIRS: readonly { pair: RegionContrastPair; fg: RegionTokenRole; kind: "text" | "non-text" }[] = [
  { pair: "foreground/background", fg: "foreground", kind: "text" },
  { pair: "muted-foreground/background", fg: "muted-foreground", kind: "text" },
  { pair: "ring/background", fg: "ring", kind: "non-text" },
  { pair: "accent/background", fg: "accent", kind: "non-text" },
];

export type RegionContrastProblem = {
  region: ThemeTokenRegion;
  mode: "light" | "dark";
  pair: RegionContrastPair;
  ratio: number; // arredondado a 2 casas
  min: number;
};

export type RegionContrastOptions = {
  regions?: ThemePaletteRules["regions"];
  // Só as regiões listadas (default: todas). O formulário legado só checa as que ele edita.
  only?: readonly ThemeTokenRegion[];
  // "kit" (default): fundo = a superfície que o kit pinta quando falta o tier-3 (--header-bg,
  // --sidebar-bg-start — ver regionSurfaceToken). "tokens": só tier-3 → tier-2, exatamente o
  // default de region-tokens.css (o que o save da paleta personalizada usa pra não barrar uma
  // superfície que a própria paleta não declarou como região).
  surfaces?: "kit" | "tokens";
};

// Checa as 5 regiões nos dois modos. `tokens` é o mapa EFETIVO de cada modo (tier-2 + tier-3,
// valores CSS crus — var()/color-mix() resolvidos aqui). Par cujo token não resolve pra cor é
// pulado (não é problema de contraste; o contrato de tokens cobre ausência).
export function checkRegionContrast(
  tokens: { light: Readonly<Record<string, string>>; dark: Readonly<Record<string, string>> },
  options: RegionContrastOptions = {},
): RegionContrastProblem[] {
  const problems: RegionContrastProblem[] = [];
  const regions = options.only ?? THEME_TOKEN_REGIONS;
  for (const mode of ["light", "dark"] as const) {
    const resolver = createTokenResolver(tokens[mode]);
    const page = resolver.color("background");
    const tokenFor = (region: ThemeTokenRegion, role: RegionTokenRole) =>
      options.surfaces === "tokens"
        ? tokens[mode][regionTokenName(region, role)] !== undefined
          ? regionTokenName(region, role)
          : role
        : regionSurfaceToken(region, role, tokens[mode]);
    for (const region of regions) {
      const background = resolver.color(tokenFor(region, "background"));
      if (!background) continue;
      const minText = options.regions?.[region]?.minContrast ?? MIN_TEXT_CONTRAST;
      for (const { pair, fg, kind } of REGION_CONTRAST_PAIRS) {
        const foreground = resolver.color(tokenFor(region, fg));
        if (!foreground) continue;
        const min = kind === "text" ? minText : MIN_NON_TEXT_CONTRAST;
        const ratio = contrastRatioColors(foreground, background, page ?? undefined);
        if (ratio + 1e-9 < min) problems.push({ region, mode, pair, ratio: Math.round(ratio * 100) / 100, min });
      }
    }
  }
  return problems;
}

export function describeRegionContrastProblem(problem: RegionContrastProblem): string {
  const mode = problem.mode === "light" ? "modo claro" : "modo escuro";
  return `Contraste ${problem.pair} na região "${problem.region}" (${mode}) é ${problem.ratio.toFixed(2)}:1 — mínimo ${problem.min}:1.`;
}
