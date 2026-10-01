import { cache } from "react";
import { getActiveColorPalette, type ColorPalette, type PaletteColorTokens } from "@/contexts/themes";
import type { ResolvedThemeDefinition, ThemePaletteChoice, ThemePaletteRules } from "@/contexts/themes/contracts/v8";
import { resolveActiveTheme } from "./resolve-active-theme";
import { CUSTOM_COLOR_PALETTE_ID, getCustomColorPalette } from "@/platform/theme-engine/custom-color-palette";

// T3 (docs/implementation-roadmap.md — Fase 5, fundação): paleta ativa resolvida pra runtime —
// null quando o paletteId salvo é "default" ou não existe (mais) no catálogo do tema ativo (ex:
// tema trocado depois de escolher uma paleta específica do tema anterior), caso em que o
// theme.css do tema ativo simplesmente vale como está, sem override nenhum. cache() pelo mesmo
// motivo de resolveActiveTheme/resolveBrandAesthetics: usado tanto no root layout (aplica o
// override) quanto potencialmente em telas admin no mesmo request.
export const resolveActiveColorPalette = cache(async (): Promise<ColorPalette | null> => {
  const [{ colorPalettes, manifest }, activePaletteResult] = await Promise.all([
    resolveActiveTheme(),
    getActiveColorPalette(),
  ]);
  if (!activePaletteResult.success) return null;

  const paletteId = activePaletteResult.data.paletteId;
  if (paletteId === "default") return null;
  if (paletteId === CUSTOM_COLOR_PALETTE_ID) return getCustomColorPalette(manifest.key);

  return colorPalettes.find((palette) => palette.id === paletteId) ?? null;
});

const TOKEN_NAME_PREFIX = "--";

function buildDeclarationBlock(tokens: PaletteColorTokens): string {
  return Object.entries(tokens)
    .map(([token, value]) => `${TOKEN_NAME_PREFIX}${token}: ${value};`)
    .join(" ");
}

// Especificidade (0,1,1) — `html[data-theme="x"]` — deliberadamente maior que o seletor de
// theme.css (`[data-theme="x"]`, especificidade 0,1,0): garante que o override vence na cascata
// sem depender de ordem de inserção no documento nem de `!important` (o `<style>` pode acabar
// renderizado em qualquer posição do body — ver comentário em layout.tsx). Mesmo raciocínio pro
// par `.dark` (0,2,1 > 0,2,0).
export function buildColorPaletteOverrideCss(themeKey: string, palette: ColorPalette): string {
  const blocks: string[] = [];
  if (Object.keys(palette.light).length > 0) {
    blocks.push(`html[data-theme="${themeKey}"] { ${buildDeclarationBlock(palette.light)} }`);
  }
  if (Object.keys(palette.dark).length > 0) {
    blocks.push(`html[data-theme="${themeKey}"].dark { ${buildDeclarationBlock(palette.dark)} }`);
  }
  return blocks.join("\n");
}

// ── v8 (spec §6 passo 9) ─────────────────────────────────────────────────────────────────────
// Escolha de paleta do documento de config → CSS de override. Dono: W1. default/preset/custom
// saem byte a byte iguais a buildColorPaletteOverrideCss; `seed` usa os tokens já gerados
// (choice.generated, que podem incluir tier-3 `region-*`); `lockedTokens` das regras do tema nunca
// saem; `scope` (galeria, W10) troca o seletor do <html> pelo de um elemento raiz.
const SAFE_TOKEN_NAME = /^[a-z][a-z0-9-]{0,63}$/;
const SAFE_COLOR_VALUE = /^(?:#[0-9a-f]{3}|#[0-9a-f]{6}|oklch\([0-9.%\s/]+\))$/i;
// Seletor de escopo: só caracteres de seletor simples (sem `{`, `}`, `;`, `<`, aspas soltas ou
// barra invertida) — o valor vai parar dentro de <style>.
const SAFE_SCOPE = /^[a-zA-Z0-9_\-#.[\]="' :>]{1,200}$/;

function safeTokens(tokens: Record<string, string>, locked: ReadonlySet<string>): PaletteColorTokens {
  return Object.fromEntries(
    Object.entries(tokens).filter(
      ([token, value]) => SAFE_TOKEN_NAME.test(token) && SAFE_COLOR_VALUE.test(value) && !locked.has(token),
    ),
  ) as PaletteColorTokens;
}

function lockedSet(rules: ThemePaletteRules | undefined): ReadonlySet<string> {
  return new Set((rules?.lockedTokens ?? []).map((token) => token.replace(/^--/, "")));
}

export function paletteFromChoice(
  colorPalettes: readonly ColorPalette[],
  choice: ThemePaletteChoice | undefined,
  rules?: ThemePaletteRules,
): ColorPalette | null {
  if (!choice || choice.mode === "default") return null;
  const locked = lockedSet(rules);
  if (choice.mode === "preset") {
    const preset = colorPalettes.find((palette) => palette.id === choice.presetId) ?? null;
    if (!preset || locked.size === 0) return preset;
    const unlocked = (tokens: PaletteColorTokens) =>
      Object.fromEntries(Object.entries(tokens).filter(([token]) => !locked.has(token))) as PaletteColorTokens;
    return { ...preset, light: unlocked(preset.light), dark: unlocked(preset.dark) };
  }
  const tokens = choice.mode === "seed" ? choice.generated : choice;
  return {
    id: CUSTOM_COLOR_PALETTE_ID,
    name: "Personalizada",
    light: safeTokens(tokens.light, locked),
    dark: safeTokens(tokens.dark, locked),
  };
}

// Seletores do override. Sem escopo: `html[data-theme="k"]` (0,1,1) — o de sempre. Com escopo:
// `<scope>[data-theme="k"]` — a raiz escopada carrega `data-theme` (spec §7.13) e o composto
// precisa vencer o `[data-theme="k"]` (0,1,0) / `.dark` (0,2,0) do theme.css que TAMBÉM casa nela.
// Escopo inválido = nenhum CSS (nunca cai pro <html> da página inteira).
function paletteSelector(themeKey: string, scope: string | undefined): string | null {
  if (scope === undefined) return `html[data-theme="${themeKey}"]`;
  if (!SAFE_SCOPE.test(scope)) return null;
  return `${scope.trim()}[data-theme="${themeKey}"]`;
}

export function buildPaletteCss(
  theme: Pick<ResolvedThemeDefinition, "key" | "colorPalettes"> & Partial<Pick<ResolvedThemeDefinition, "palette">>,
  choice: ThemePaletteChoice | undefined,
  context: { scope?: string } = {},
): string {
  const palette = paletteFromChoice(theme.colorPalettes, choice, theme.palette);
  if (!palette) return "";
  const css = buildColorPaletteOverrideCss(theme.key, palette);
  if (context.scope === undefined) return css;
  const selector = paletteSelector(theme.key, context.scope);
  if (!selector) return "";
  return css.split(`html[data-theme="${theme.key}"]`).join(selector);
}
