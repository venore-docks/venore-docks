import type { ThemePaletteRules, ThemeTokenRegion } from "@/contexts/themes/contracts/v8";
import type { ThemeTokenValues } from "@/themes/theme-tokens.generated";
import { checkRegionContrast, MIN_TEXT_CONTRAST, type RegionContrastProblem } from "../contrast";
import { parseCssColor, type CssColor, type Oklch } from "../oklch-color";
import { createTokenResolver, effectiveTokens, THEME_TOKEN_REGIONS } from "../token-values";
import { buildRegionTone, regionToneToTokens } from "./region-tones";
import { accentHue, buildSeedTokens } from "./seed-tokens";

// Gerador de paleta unificado (spec v8 §7.14, capacidade P). Uma entrada pra três usos:
//   - "1 cor de marca" e presets (semente → 25 tokens tier-2, o gerador de sempre);
//   - regras de paleta do tema (`manifest.palette`): accent, tokens travados e tom por região —
//     ex: `regions.rail = { tone: "dark" }` mantém o rail escuro mesmo com uma semente clara;
//   - checagem de contraste por região do resultado (`problems`), contra a base do tema.
// `base` vem de theme-tokens.generated.ts (o theme.css parseado), nunca de literal duplicado.
// Sem regras e sem base, light/dark saem byte a byte iguais ao buildFullPaletteFromSeed antigo.

export type GenerateThemePaletteInput = {
  // Semente: hex/oklch (string) ou já em OKLCH. null = sem semente (só os tons de região sobre a base).
  seed: string | Oklch | null;
  rules?: ThemePaletteRules | null;
  base?: ThemeTokenValues | null;
};

export type GeneratedThemePalette = {
  light: Record<string, string>;
  dark: Record<string, string>;
  problems: RegionContrastProblem[];
};

function toSeed(seed: GenerateThemePaletteInput["seed"]): Oklch | null {
  if (seed === null) return null;
  if (typeof seed !== "string") return seed;
  const parsed = parseCssColor(seed);
  return parsed ? { l: parsed.l, c: parsed.c, h: parsed.h } : null;
}

const stripDashes = (token: string) => token.replace(/^--/, "");

export function generateThemePalette(input: GenerateThemePaletteInput): GeneratedThemePalette {
  const rules = input.rules ?? {};
  const base = input.base ?? null;
  const seed = toSeed(input.seed);
  const accent = rules.accent ?? "complement";

  const seeded = seed ? buildSeedTokens(seed, accent) : { light: {}, dark: {} };
  const light: Record<string, string> = { ...(seeded.light as Record<string, string>) };
  const dark: Record<string, string> = { ...(seeded.dark as Record<string, string>) };

  const toned = THEME_TOKEN_REGIONS.filter(
    (region): region is ThemeTokenRegion => (rules.regions?.[region]?.tone ?? "inherit") !== "inherit",
  );
  if (toned.length > 0) {
    const effective = effectiveTokens(base, { light, dark });
    for (const mode of ["light", "dark"] as const) {
      const resolver = createTokenResolver(effective[mode]);
      const primary: CssColor =
        resolver.color("primary") ?? { ...(seed ?? { l: 0.55, c: 0.12, h: 250 }), alpha: 1, hueMissing: false };
      const hue = seed?.h ?? primary.h;
      const chroma = seed?.c ?? primary.c;
      const target = mode === "light" ? light : dark;
      for (const region of toned) {
        const rule = rules.regions![region]!;
        const tokens = buildRegionTone({
          region,
          tone: rule.tone as Exclude<typeof rule.tone, "inherit">,
          minContrast: rule.minContrast ?? MIN_TEXT_CONTRAST,
          hue,
          chroma,
          primary,
          accentHue: accentHue(hue, accent),
        });
        Object.assign(target, regionToneToTokens(region, tokens));
      }
    }
  }

  // Tokens travados pelo tema não saem no override: o valor do theme.css continua valendo.
  for (const locked of rules.lockedTokens ?? []) {
    delete light[stripDashes(locked)];
    delete dark[stripDashes(locked)];
  }

  const problems = checkRegionContrast(effectiveTokens(base, { light, dark }), { regions: rules.regions });
  return { light, dark, problems };
}
