import type { RegionTokenRole, RegionTone, ThemeTokenRegion } from "@/contexts/themes/contracts/v8";
import { contrastRatioColors, MIN_NON_TEXT_CONTRAST, MIN_TEXT_CONTRAST } from "../contrast";
import type { CssColor, Oklch } from "../oklch-color";
import { regionTokenName } from "../token-values";
import { clamp01, normalizeHue, toHex } from "./seed-tokens";

// Tons de região (spec §7.14): uma região com `tone` ≠ "inherit" ganha os 12 papéis tier-3
// (`--region-<região>-<papel>`) calculados pra passar no contraste por construção — cada cor de
// texto/elemento é empurrada em L até bater o mínimo contra o fundo da própria região.
//   dark  → fundo L ≤ 0.28 e texto L ≥ 0.92, nos DOIS modos (ex: o rail sempre escuro da Aurora);
//   light → o inverso (fundo L ≥ 0.94, texto L ≤ 0.3);
//   brand → o primary do modo como fundo, texto calculado.
// Os números abaixo são parâmetros do GERADOR (como os níveis de seed-tokens.ts), não tokens de
// design de um tema: o resultado vira valor gravado na paleta (override runtime), nunca CSS do core.

const DARK_TONE = { background: 0.22, card: 0.255, muted: 0.285, border: 0.34, foreground: 0.96, mutedForeground: 0.8, primary: 0.72, accent: 0.64 };
const LIGHT_TONE = { background: 0.975, card: 0.995, muted: 0.935, border: 0.87, foreground: 0.22, mutedForeground: 0.45, primary: 0.5, accent: 0.5 };
const DARK_TONE_MAX_BACKGROUND_L = 0.28;
const DARK_TONE_MIN_FOREGROUND_L = 0.92;
const SURFACE_CHROMA_RATIO = 0.12;
const SURFACE_CHROMA_MAX = 0.03;
const TEXT_CHROMA = 0.012;
const BRAND_SHIFT = { card: 0.04, muted: 0.07, border: 0.14, accent: 0.32, mutedForeground: 0.18 };
const L_STEP = 0.01;

export type RegionToneInput = {
  region: ThemeTokenRegion;
  tone: Exclude<RegionTone, "inherit">;
  minContrast: number;
  hue: number;
  chroma: number; // chroma da semente/primary — os tons de superfície levam uma fração dela
  primary: CssColor; // primary efetivo do modo (fundo do tom "brand")
  accentHue: number;
};

const opaque = (color: Oklch): CssColor => ({ ...color, alpha: 1, hueMissing: color.c < 1e-6 });

// Move L (no sentido `direction`, depois no oposto) até `color` ter `min` contra `against`. Se nem
// o extremo bate (fundo de L médio com mínimo alto), fica o melhor encontrado — o problema aparece
// em `problems` do gerador.
export function ensureContrast(color: Oklch, against: CssColor, min: number, direction: 1 | -1): Oklch {
  const ratio = (candidate: Oklch) => contrastRatioColors(opaque(candidate), against);
  if (ratio(color) >= min) return color;
  let best = color;
  for (const dir of [direction, -direction as 1 | -1]) {
    for (let l = color.l; l >= 0 && l <= 1; l += dir * L_STEP) {
      const candidate = { ...color, l: clamp01(l) };
      if (ratio(candidate) >= min) return candidate;
      if (ratio(candidate) > ratio(best)) best = candidate;
    }
  }
  return best;
}

// Texto legível sobre `background`: claro ou escuro, o que der mais contraste.
function readableOn(background: CssColor, hue: number, min: number): Oklch {
  const light = { l: 0.98, c: TEXT_CHROMA, h: hue };
  const dark = { l: 0.16, c: TEXT_CHROMA, h: hue };
  const pick = contrastRatioColors(opaque(light), background) >= contrastRatioColors(opaque(dark), background) ? light : dark;
  return ensureContrast(pick, background, min, pick === light ? 1 : -1);
}

function shiftToward(color: Oklch, target: Oklch, amount: number): Oklch {
  return { ...color, l: clamp01(color.l + Math.sign(target.l - color.l) * amount) };
}

export type RegionToneTokens = Partial<Record<RegionTokenRole, Oklch>>;

export function buildRegionTone(input: RegionToneInput): RegionToneTokens {
  const { tone, hue, minContrast } = input;
  const surfaceC = Math.min(SURFACE_CHROMA_MAX, input.chroma * SURFACE_CHROMA_RATIO);

  if (tone === "brand") {
    const background: Oklch = { l: input.primary.l, c: input.primary.c, h: input.primary.h };
    const bg = opaque(background);
    const foreground = readableOn(bg, hue, minContrast);
    const card = shiftToward(background, foreground, BRAND_SHIFT.card);
    const muted = shiftToward(background, foreground, BRAND_SHIFT.muted);
    const accent = ensureContrast(shiftToward(background, foreground, BRAND_SHIFT.accent), bg, MIN_NON_TEXT_CONTRAST, foreground.l > background.l ? 1 : -1);
    return {
      background,
      foreground,
      card,
      "card-foreground": readableOn(opaque(card), hue, minContrast),
      muted,
      "muted-foreground": ensureContrast(shiftToward(foreground, background, BRAND_SHIFT.mutedForeground), bg, minContrast, foreground.l > background.l ? 1 : -1),
      primary: foreground,
      "primary-foreground": background,
      accent,
      "accent-foreground": readableOn(opaque(accent), hue, MIN_TEXT_CONTRAST),
      border: shiftToward(background, foreground, BRAND_SHIFT.border),
      ring: foreground,
    };
  }

  const levels = tone === "dark" ? DARK_TONE : LIGHT_TONE;
  const textDirection: 1 | -1 = tone === "dark" ? 1 : -1;
  const background: Oklch = { l: levels.background, c: surfaceC, h: hue };
  const bg = opaque(background);
  let foreground = ensureContrast({ l: levels.foreground, c: TEXT_CHROMA, h: hue }, bg, minContrast, textDirection);
  if (tone === "dark") foreground = { ...foreground, l: Math.max(foreground.l, DARK_TONE_MIN_FOREGROUND_L) };
  const card: Oklch = { l: levels.card, c: surfaceC, h: hue };
  const primary = ensureContrast({ l: levels.primary, c: input.chroma, h: hue }, bg, MIN_NON_TEXT_CONTRAST, textDirection);
  const accent = ensureContrast({ l: levels.accent, c: input.chroma * 0.9, h: normalizeHue(input.accentHue) }, bg, MIN_NON_TEXT_CONTRAST, textDirection);
  return {
    background: { ...background, l: tone === "dark" ? Math.min(background.l, DARK_TONE_MAX_BACKGROUND_L) : background.l },
    foreground,
    card,
    "card-foreground": ensureContrast(foreground, opaque(card), minContrast, textDirection),
    muted: { l: levels.muted, c: surfaceC, h: hue },
    "muted-foreground": ensureContrast({ l: levels.mutedForeground, c: TEXT_CHROMA * 2, h: hue }, bg, minContrast, textDirection),
    primary,
    "primary-foreground": readableOn(opaque(primary), hue, MIN_TEXT_CONTRAST),
    accent,
    "accent-foreground": readableOn(opaque(accent), hue, MIN_TEXT_CONTRAST),
    border: { l: levels.border, c: surfaceC, h: hue },
    ring: primary,
  };
}

// Tier-3 em hex (o formato que a paleta personalizada grava) + a superfície tier-2 que o kit pinta
// naquela região (o header pinta --header-bg; o rail, o gradiente --sidebar-bg-*): sem isso o
// `tone` mudaria os tokens de dentro mas não o fundo visível.
export function regionToneToTokens(region: ThemeTokenRegion, tokens: RegionToneTokens): Record<string, string> {
  const hex = (color: Oklch) => toHex(color.l, color.c, color.h);
  const out: Record<string, string> = {};
  for (const [role, color] of Object.entries(tokens) as [RegionTokenRole, Oklch][]) {
    out[regionTokenName(region, role)] = hex(color);
  }
  const background = tokens.background;
  if (background && region === "header") out["header-bg"] = hex(background);
  if (background && region === "rail") {
    const end = { ...background, l: clamp01(background.l - 0.025) };
    out["sidebar-bg-start"] = hex(background);
    out["sidebar-bg-end"] = hex(end);
    out["sidebar-bg-admin-start"] = hex(background);
    out["sidebar-bg-admin-end"] = hex(end);
  }
  return out;
}
